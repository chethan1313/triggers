FILENAME=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\migration\Version-1.0.1.js

line=6=66

update+++++++++
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\api\updateCustomer\updateCustomer.js
41
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\services\customer\updatePassword.js
18
delete++++++++++
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\pages\frontStore\all\[context]auth.js
30
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\services\customer\deleteCustomer.js
14
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\services\customer\updateCustomer.js
55
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\services\customer\loginCustomerWithEmail.js
28
insert++++++++++
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\services\customer\createCustomer.js
45


-----------------------------------------------------------for inserting while creating customer 

CREATE OR REPLACE PROCEDURE add_customer_created_event(
    DATA_JSON VARIANT  -- JSON with key-value pairs for fields to insert into CUSTOMER
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // Begin transaction.
    snowflake.execute({ sqlText: `BEGIN TRANSACTION` });
    
    const data = DATA_JSON;
    let columns = [];
    let values = [];
    
    // Build the dynamic INSERT statement for CUSTOMER.
    for (const key in data) {
        columns.push(key);
        let val = data[key];
        if (typeof val === 'string') {
            // Escape single quotes.
            val = val.replace(/'/g, "''");
            values.push(`'${val}'`);
        } else if (typeof val === 'boolean') {
            values.push(val ? "TRUE" : "FALSE");
        } else if (val === null) {
            values.push("NULL");
        } else {
            values.push(val.toString());
        }
    }
    
    const insertSQL = `
        INSERT INTO CUSTOMER (${columns.join(", ")})
        VALUES (${values.join(", ")})
    `;
    const stmtInsert = snowflake.createStatement({ sqlText: insertSQL });
    stmtInsert.execute();
    
    // Retrieve the newly inserted CUSTOMER row.
    // (Assumes no concurrent inserts; selects the row with the highest CUSTOMER_ID)
    const selectSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM CUSTOMER
        ORDER BY CUSTOMER_ID DESC
        LIMIT 1
    `;
    const stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    const result = stmtSelect.execute();
    if (!result.next()) {
        throw new Error("No inserted customer found.");
    }
    const insertedRow = result.getColumnValue("row_data");
    
    // Log an event in the EVENT table.
    let eventDataStr = JSON.stringify(insertedRow).replace(/'/g, "''");
    const eventSQL = `
        INSERT INTO EVENT (NAME, DATA)
        SELECT 'customer_created', PARSE_JSON('${eventDataStr}')
    `;
    const stmtEvent = snowflake.createStatement({ sqlText: eventSQL });
    stmtEvent.execute();
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // Return the inserted row as a VARIANT.
    return insertedRow;
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error("Error: " + err);
}
$$;

CALL add_customer_created_event(
    PARSE_JSON('{
        "EMAIL": "john.doe@example.com",
        "PASSWORD": "secretPassword",
        "FULL_NAME": "John Doe"
    }')
);



--------------------------------------------------------------for inserting into event while updating the customer

CREATE OR REPLACE PROCEDURE add_customer_updated_event(
    DATA_JSON VARIANT,   -- JSON with key-value pairs for fields to update in CUSTOMER
    whereClause STRING   -- WHERE clause (e.g., "CUSTOMER_ID = 301")
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // Begin transaction.
    snowflake.execute({ sqlText: `BEGIN TRANSACTION` });
    
    // Validate the WHERE clause.
    if (!whereClause || whereClause.trim() === "") {
        throw new Error("WHERE clause is required for update.");
    }
    
    // Build the dynamic UPDATE statement for the CUSTOMER table.
    const data = DATA_JSON;
    let setClauses = [];
    for (const key in data) {
        let val = data[key];
        if (typeof val === "string") {
            val = val.replace(/'/g, "''");
            setClauses.push(`${key} = '${val}'`);
        } else if (typeof val === "boolean") {
            setClauses.push(`${key} = ${val ? "TRUE" : "FALSE"}`);
        } else if (val === null) {
            setClauses.push(`${key} = NULL`);
        } else {
            setClauses.push(`${key} = ${val}`);
        }
    }
    
    const updateSQL = `
        UPDATE CUSTOMER
        SET ${setClauses.join(", ")}
        WHERE ${whereClause}
    `;
    const stmtUpdate = snowflake.createStatement({ sqlText: updateSQL });
    stmtUpdate.execute();
    
    // Retrieve the updated CUSTOMER row using OBJECT_CONSTRUCT_KEEP_NULL(*)
    const selectSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM CUSTOMER
        WHERE ${whereClause}
        LIMIT 1
    `;
    const stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    const resultSelect = stmtSelect.execute();
    if (!resultSelect.next()) {
        throw new Error("No customer found for the given WHERE clause.");
    }
    const updatedRow = resultSelect.getColumnValue("row_data");
    
    // Log the customer_updated event.
    let eventDataStr = JSON.stringify(updatedRow).replace(/'/g, "''");
    const eventSQL = `
        INSERT INTO EVENT (NAME, DATA)
        SELECT 'customer_updated', PARSE_JSON('${eventDataStr}')
    `;
    const stmtEvent = snowflake.createStatement({ sqlText: eventSQL });
    stmtEvent.execute();
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // Return the updated customer row as a VARIANT.
    return updatedRow;
    
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error("Error: " + err);
}
$$;

CALL add_customer_updated_event(
    PARSE_JSON('{"EMAIL": "new.email@example.com", "FULL_NAME": "New Customer Name"}'),
    'CUSTOMER_ID = 301'
);

-------------------------------------------------------------------for inserting while deleting the customer

CREATE OR REPLACE PROCEDURE add_customer_deleted_event(
    whereClause STRING  -- WHERE clause, e.g. "CUSTOMER_ID = 401"
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // Begin transaction.
    snowflake.execute({ sqlText: `BEGIN TRANSACTION` });
    
    // Validate the WHERE clause.
    if (!whereClause || whereClause.trim() === "") {
        throw new Error("WHERE clause is required for deletion.");
    }
    
    // --- 1. Retrieve rows to be deleted using OBJECT_CONSTRUCT_KEEP_NULL(*) ---
    const selectSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM CUSTOMER
        WHERE ${whereClause}
    `;
    const stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    const result = stmtSelect.execute();
    
    let rowsToDelete = [];
    if (!result.next()) {
        throw new Error("No customer found for the given WHERE clause.");
    }
    do {
        const row = result.getColumnValue("row_data");
        rowsToDelete.push(row);
    } while (result.next());
    
    // --- 2. For each row, log an event in the EVENT table ---
    for (let j = 0; j < rowsToDelete.length; j++) {
        let rowDataStr = JSON.stringify(rowsToDelete[j]).replace(/'/g, "''");
        const eventSQL = `
            INSERT INTO EVENT (NAME, DATA)
            SELECT 'customer_deleted', PARSE_JSON('${rowDataStr}')
        `;
        const stmtEvent = snowflake.createStatement({ sqlText: eventSQL });
        stmtEvent.execute();
    }
    
    // --- 3. Delete the rows from the CUSTOMER table ---
    const deleteSQL = `
        DELETE FROM CUSTOMER
        WHERE ${whereClause}
    `;
    const stmtDelete = snowflake.createStatement({ sqlText: deleteSQL });
    stmtDelete.execute();
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // --- 4. Return the deleted rows as a VARIANT (JSON array) ---
    return rowsToDelete;
    
} catch (err) {
    // Rollback if any error occurs.
    try {
        snowflake.execute({ sqlText: `ROLLBACK` });
    } catch(e) { }
    throw new Error("Error: " + err);
}
$$;


CALL add_customer_deleted_event('CUSTOMER_ID = 401');

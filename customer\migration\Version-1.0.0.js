filename=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\migration\Version-1.0.0.js

line=72-92

CREATE OR REPLACE PROCEDURE prevent_delete_default_customer_group(
    whereClause STRING  -- WHERE clause, e.g. "CUSTOMER_GROUP_ID = 101"
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
    
    // --- 1. Retrieve the rows that match the WHERE clause using OBJECT_CONSTRUCT_KEEP_NULL(*) ---
    const selectQuery = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM CUSTOMER_GROUP
        WHERE ${whereClause}
    `;
    const stmtSelect = snowflake.createStatement({ sqlText: selectQuery });
    const result = stmtSelect.execute();
    
    let rowsToDelete = [];
    if (!result.next()) {
        throw new Error("No customer group found for the given WHERE clause.");
    }
    // Process the first row and all subsequent rows.
    do {
        const row = result.getColumnValue("row_data");
        // Check if this is the default customer group.
        if (row["CUSTOMER_GROUP_ID"] == 1) {
            throw new Error("Cannot delete default customer group");
        }
        rowsToDelete.push(row);
    } while (result.next());
    
    // --- 2. Perform the DELETE ---
    const deleteQuery = `
        DELETE FROM CUSTOMER_GROUP
        WHERE ${whereClause}
    `;
    const stmtDelete = snowflake.createStatement({ sqlText: deleteQuery });
    stmtDelete.execute();
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // --- 3. Return the details of the deleted rows as a VARIANT ---
    return rowsToDelete;
    
} catch (err) {
    // Rollback if any error occurs.
    try {
        snowflake.execute({ sqlText: `ROLLBACK` });
    } catch(e) { }
    throw new Error("Error: " + err);
}
$$;

CALL prevent_delete_default_customer_group('CUSTOMER_GROUP_ID = 101');



****************************************************************************************************************

  line=95-116

C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\services\customer\createCustomer.js
45


CREATE OR REPLACE PROCEDURE set_default_customer_group(
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
    
    // Mimic trigger logic: if GROUP_ID is missing or null, set it to 1.
    if (!data.hasOwnProperty("GROUP_ID") || data["GROUP_ID"] === null) {
        data["GROUP_ID"] = 1;
    }
    
    // Build dynamic INSERT statement.
    let columns = [];
    let values = [];
    
    for (const key in data) {
        columns.push(key);
        let val = data[key];
        if (typeof val === "string") {
            // Escape single quotes.
            val = val.replace(/'/g, "''");
            values.push(`'${val}'`);
        } else if (typeof val === "boolean") {
            values.push(val ? "TRUE" : "FALSE");
        } else if (val === null) {
            values.push("NULL");
        } else {
            values.push(val.toString());
        }
    }
    
    const insertQuery = `
        INSERT INTO CUSTOMER (${columns.join(", ")})
        VALUES (${values.join(", ")})
    `;
    const stmtInsert = snowflake.createStatement({ sqlText: insertQuery });
    stmtInsert.execute();
    
    // Retrieve the newly inserted CUSTOMER row using OBJECT_CONSTRUCT_KEEP_NULL(*)
    // (Assuming no concurrent inserts, the row with the highest CUSTOMER_ID is the new one)
    const selectQuery = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM CUSTOMER
        ORDER BY CUSTOMER_ID DESC
        LIMIT 1
    `;
    const stmtSelect = snowflake.createStatement({ sqlText: selectQuery });
    const resultSelect = stmtSelect.execute();
    if (!resultSelect.next()) {
        throw new Error("No inserted customer found.");
    }
    const insertedRow = resultSelect.getColumnValue("row_data");
    
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


CALL set_default_customer_group(
    PARSE_JSON('{
        "EMAIL": "john.doe@example.com",
        "PASSWORD": "secretPassword",
        "FULL_NAME": "John Doe",
        "GROUP_ID": null
    }')
);


file name=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.4.js

line=6-24

C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\product\updateProduct.js
43
350 for productdata
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\checkout\migration\Version-1.0.2.js
14
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\oms\services\cancelOrder.js
50



CREATE OR REPLACE PROCEDURE UPDATE_PRODUCT_INVENTORY_WITH_EVENT(
    DATA_JSON VARIANT,   -- JSON with update field-value pairs
    whereClause STRING   -- WHERE clause (e.g., "PRODUCT_INVENTORY_ID = 101")
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
    
    // --- 1. Retrieve the OLD row using OBJECT_CONSTRUCT_KEEP_NULL(*) ---
    const selectOldQuery = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM PRODUCT_INVENTORY
        WHERE ${whereClause}
    `;
    const stmtOld = snowflake.createStatement({ sqlText: selectOldQuery });
    const resultOld = stmtOld.execute();
    if (!resultOld.next()) {
        throw new Error("No matching row found for update.");
    }
    const oldRow = resultOld.getColumnValue("row_data");
    
    // --- 2. Perform the UPDATE ---
    const data = DATA_JSON;
    let setClauses = [];
    for (const key in data) {
        let val = data[key];
        if (typeof val === 'string') {
            val = val.replace(/'/g, "''");
            setClauses.push(`${key} = '${val}'`);
        } else if (typeof val === 'boolean') {
            setClauses.push(`${key} = ${val ? 'TRUE' : 'FALSE'}`);
        } else if (val === null) {
            setClauses.push(`${key} = NULL`);
        } else {
            setClauses.push(`${key} = ${val.toString()}`);
        }
    }
    const updateQuery = `
        UPDATE PRODUCT_INVENTORY
        SET ${setClauses.join(", ")}
        WHERE ${whereClause}
    `;
    const stmtUpdate = snowflake.createStatement({ sqlText: updateQuery });
    stmtUpdate.execute();
    
    // --- 3. Retrieve the NEW row using OBJECT_CONSTRUCT_KEEP_NULL(*) ---
    const selectNewQuery = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM PRODUCT_INVENTORY
        WHERE ${whereClause}
    `;
    const stmtNew = snowflake.createStatement({ sqlText: selectNewQuery });
    const resultNew = stmtNew.execute();
    if (!resultNew.next()) {
        throw new Error("Unable to retrieve updated row.");
    }
    const newRow = resultNew.getColumnValue("row_data");
    
    // --- 4. Insert an event record into the EVENT table ---
    const eventData = { old: oldRow, new: newRow };
    let eventDataStr = JSON.stringify(eventData).replace(/'/g, "''");
    const insertEventQuery = `
        INSERT INTO EVENT (NAME, DATA)
        SELECT 'inventory_updated', PARSE_JSON('${eventDataStr}')
    `;
    const stmtEvent = snowflake.createStatement({ sqlText: insertEventQuery });
    stmtEvent.execute();
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // --- 5. Return the updated (NEW) row as a VARIANT ---
    return newRow;
    
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error("Error: " + err);
}
$$;


CALL UPDATE_PRODUCT_INVENTORY_WITH_EVENT(
    PARSE_JSON('{"QTY": 45, "STOCK_AVAILABILITY": true}'),
    'PRODUCT_INVENTORY_ID = 101'
);


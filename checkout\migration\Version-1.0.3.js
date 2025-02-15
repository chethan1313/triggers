filename=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\checkout\migration\Version-1.0.3.js

line=6-24

C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\checkout\services\orderCreator.js
150



CREATE OR REPLACE PROCEDURE add_order_created_event(
    DATA_JSON VARIANT  -- JSON with key-value pairs for fields to insert into SALES_ORDER
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
    
    // --- 1. Build the dynamic INSERT statement for SALES_ORDER ---
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
        INSERT INTO SALES_ORDER (${columns.join(", ")})
        VALUES (${values.join(", ")})
    `;
    const stmtInsert = snowflake.createStatement({ sqlText: insertSQL });
    stmtInsert.execute();
    
    // --- 2. Retrieve the newly inserted SALES_ORDER row ---
    // (Assumes no concurrent inserts; selects the row with the highest ORDER_ID)
    const selectSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM SALES_ORDER
        ORDER BY ORDER_ID DESC
        LIMIT 1
    `;
    const stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    const resultSelect = stmtSelect.execute();
    if (!resultSelect.next()) {
        throw new Error("No inserted order found.");
    }
    const insertedRow = resultSelect.getColumnValue("row_data");
    
    // --- 3. Log the event in the EVENT table ---
    let eventDataStr = JSON.stringify(insertedRow).replace(/'/g, "''");
    const eventSQL = `
        INSERT INTO EVENT (NAME, DATA)
        SELECT 'order_created', PARSE_JSON('${eventDataStr}')
    `;
    const stmtEvent = snowflake.createStatement({ sqlText: eventSQL });
    stmtEvent.execute();
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // --- 4. Return the inserted order as a VARIANT ---
    return insertedRow;
    
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error("Error: " + err);
}
$$;


CALL add_order_created_event(
    PARSE_JSON('{
        "ORDER_NUMBER": "SO-1001",
        "STATUS": "pending",
        "CART_ID": 200,
        "CURRENCY": "USD",
        "SUB_TOTAL": 250.00,
        "SUB_TOTAL_INCL_TAX": 275.00,
        "SUB_TOTAL_WITH_DISCOUNT": 250.00,
        "SUB_TOTAL_WITH_DISCOUNT_INCL_TAX": 275.00,
        "TOTAL_QTY": 5,
        "TAX_AMOUNT": 25.00,
        "TAX_AMOUNT_BEFORE_DISCOUNT": 25.00,
        "SHIPPING_TAX_AMOUNT": 5.00,
        "GRAND_TOTAL": 280.00
    }')
);

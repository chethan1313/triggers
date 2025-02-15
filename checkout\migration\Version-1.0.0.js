filename=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\checkout\migration\Version-1.0.0.js

line=271-290

C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\checkout\services\orderCreator.js
172

CREATE OR REPLACE PROCEDURE reduce_product_stock_when_order_placed(
    DATA_JSON VARIANT  -- JSON with key-value pairs for fields to insert into ORDER_ITEM
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
    
    // --- 1. Insert a new order item into ORDER_ITEM ---
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
    
    const insertQuery = `
        INSERT INTO ORDER_ITEM (${columns.join(", ")})
        VALUES (${values.join(", ")})
    `;
    const stmtInsert = snowflake.createStatement({ sqlText: insertQuery });
    stmtInsert.execute();
    
    // --- 2. Retrieve the newly inserted order item ---
    // Assumes no concurrent inserts; selects the row with the highest ORDER_ITEM_ID.
    const selectQuery = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM ORDER_ITEM
        ORDER BY ORDER_ITEM_ID DESC
        LIMIT 1
    `;
    const stmtSelect = snowflake.createStatement({ sqlText: selectQuery });
    const resultSelect = stmtSelect.execute();
    if (!resultSelect.next()) {
        throw new Error("No inserted order item found.");
    }
    const insertedRow = resultSelect.getColumnValue("row_data");
    
    // --- 3. Update the PRODUCT table stock (reduce stock only if manage_stock = TRUE) ---
    const prodId = insertedRow["PRODUCT_ID"];
    const orderQty = insertedRow["QTY"];
    
    if (prodId === null || orderQty === null) {
        throw new Error("Inserted order item does not have PRODUCT_ID or QTY.");
    }
    
    const updateProductQuery = `
        UPDATE PRODUCT
        SET QTY = QTY - ${orderQty}
        WHERE PRODUCT_ID = ${prodId} AND MANAGE_STOCK = TRUE
    `;
    const stmtUpdateProd = snowflake.createStatement({ sqlText: updateProductQuery });
    stmtUpdateProd.execute();
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // Return the inserted order item as a VARIANT.
    return insertedRow;
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error("Error: " + err);
}
$$;


CALL reduce_product_stock_when_order_placed(
    PARSE_JSON('{
        "ORDER_ITEM_ORDER_ID": 500,
        "PRODUCT_ID": 601,
        "PRODUCT_SKU": "SKU-101",
        "PRODUCT_NAME": "Test Product",
        "QTY": 1,
        "PRODUCT_PRICE": 100.00,
        "PRODUCT_PRICE_INCL_TAX": 110.00,
        "FINAL_PRICE": 100.00,
        "FINAL_PRICE_INCL_TAX": 110.00,
        "TAX_PERCENT": 10.0,
        "TAX_AMOUNT": 10.00,
        "TAX_AMOUNT_BEFORE_DISCOUNT": 10.00,
        "DISCOUNT_AMOUNT": 0.00,
        "LINE_TOTAL": 300.00,
        "LINE_TOTAL_WITH_DISCOUNT": 300.00,
        "LINE_TOTAL_INCL_TAX": 330.00,
        "LINE_TOTAL_WITH_DISCOUNT_INCL_TAX": 330.00
    }')
);

file name=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\checkout\migration\Version-1.0.2.js

line=6-31

CREATE OR REPLACE PROCEDURE INSERT_ORDER_ITEM_AND_UPDATE_PRODUCT_INVENTORY(
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
    
    // --- 1. Build and execute the INSERT into ORDER_ITEM ---
    for (const key in data) {
        columns.push(key);
        let val = data[key];
        if (typeof val === 'string') {
            // Escape any single quotes.
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
    
    // --- 2. Retrieve the newly inserted ORDER_ITEM row ---
    // Assumes no concurrent inserts; selects the row with the highest ORDER_ITEM_ID.
    const selectOrderItemSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM ORDER_ITEM
        ORDER BY ORDER_ITEM_ID DESC
        LIMIT 1
    `;
    const stmtSelectOrderItem = snowflake.createStatement({ sqlText: selectOrderItemSQL });
    const resultOrderItem = stmtSelectOrderItem.execute();
    if (!resultOrderItem.next()) {
        throw new Error("No inserted order item found.");
    }
    const insertedRow = resultOrderItem.getColumnValue("row_data");
    
    // --- 3. Update the PRODUCT_INVENTORY table ---
    // Extract PRODUCT_ID and QTY from the inserted order item.
    const prodId = insertedRow["PRODUCT_ID"];
    const orderQty = insertedRow["QTY"];
    
    if (prodId === null || orderQty === null) {
        throw new Error("Inserted order item does not have PRODUCT_ID or QTY.");
    }
    
    const updateQuery = `
        UPDATE PRODUCT_INVENTORY
        SET QTY = QTY - ${orderQty}
        WHERE PRODUCT_INVENTORY_PRODUCT_ID = ${prodId}
          AND MANAGE_STOCK = TRUE
    `;
    const stmtUpdate = snowflake.createStatement({ sqlText: updateQuery });
    stmtUpdate.execute();
    
    // --- 4. Retrieve the updated PRODUCT_INVENTORY row ---
    const selectInvSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM PRODUCT_INVENTORY
        WHERE PRODUCT_INVENTORY_PRODUCT_ID = ${prodId}
        LIMIT 1
    `;
    const stmtSelectInv = snowflake.createStatement({ sqlText: selectInvSQL });
    const resultInv = stmtSelectInv.execute();
    if (!resultInv.next()) {
        throw new Error("No updated product inventory row found.");
    }
    const updatedInvRow = resultInv.getColumnValue("row_data");
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // --- 5. Return the updated PRODUCT_INVENTORY row as a VARIANT ---
    return updatedInvRow;
    
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error("Error: " + err);
}
$$;


CALL INSERT_ORDER_ITEM_AND_UPDATE_PRODUCT_INVENTORY(
    PARSE_JSON('{
        "ORDER_ITEM_ORDER_ID": 500,
        "PRODUCT_ID": 101,
        "PRODUCT_SKU": "SKU-101",
        "PRODUCT_NAME": "Test Product",
        "QTY": 40,
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

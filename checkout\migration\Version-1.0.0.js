filename=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\checkout\migration\Version-1.0.0.js

line=271-290

CREATE OR REPLACE PROCEDURE REDUCE_PRODUCT_STOCK_ON_ORDER(
    PRODUCT_ID STRING,  -- Use STRING instead of NUMBER
    QTY STRING         -- Use STRING instead of NUMBER
)
RETURNS STRING
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS $$
try {
    // Convert input strings to numbers
    var productId = Number(PRODUCT_ID);
    var orderQty = Number(QTY);

    // Start transaction
    snowflake.execute({ sqlText: `BEGIN TRANSACTION;` });

    // 1. Check if the product exists and manages stock
    var checkStmt = snowflake.createStatement({
        sqlText: `
            SELECT COUNT(*) 
            FROM EVERSHOP_COPY.PUBLIC.PRODUCT 
            WHERE PRODUCT_ID = ? 
              AND STATUS = TRUE;`, // STATUS TRUE indicates that stock is managed
        binds: [productId]
    });
    var checkResult = checkStmt.execute();
    checkResult.next();
    var productExists = checkResult.getColumnValue(1);

    if (productExists === 0) {
        throw "Product does not exist or is not active.";
    }

    // 2. Retrieve the current stock quantity
    var stockStmt = snowflake.createStatement({
        sqlText: `
            SELECT QTY 
            FROM EVERSHOP_COPY.PUBLIC.PRODUCT 
            WHERE PRODUCT_ID = ?;`,
        binds: [productId]
    });
    var stockResult = stockStmt.execute();
    stockResult.next();
    var currentStock = stockResult.getColumnValue(1);

    // 3. Check if enough stock is available
    if (currentStock < orderQty) {
        throw "Insufficient stock available.";
    }

    // 4. Reduce the product stock
    var updateStmt = snowflake.createStatement({
        sqlText: `
            UPDATE EVERSHOP_COPY.PUBLIC.PRODUCT 
            SET QTY = QTY - ? 
            WHERE PRODUCT_ID = ?;`,
        binds: [orderQty, productId]
    });
    var updateResult = updateStmt.execute();

    // 5. Verify the stock was updated
    if (updateResult.getRowCount() === 0) {
        throw "Failed to update product stock.";
    }

    // Commit transaction
    snowflake.execute({ sqlText: `COMMIT;` });
    return "Product stock reduced successfully.";
} catch (err) {
    // Rollback on error
    snowflake.execute({ sqlText: `ROLLBACK;` });
    return "Error: " + err;
}
$$;

INSERT INTO EVERSHOP_COPY.PUBLIC.ORDER_ITEM (
    ORDER_ITEM_ORDER_ID, 
    PRODUCT_ID, 
    PRODUCT_SKU, 
    PRODUCT_NAME, 
    QTY, 
    PRODUCT_PRICE, 
    PRODUCT_PRICE_INCL_TAX, 
    FINAL_PRICE, 
    FINAL_PRICE_INCL_TAX, 
    TAX_PERCENT, 
    TAX_AMOUNT, 
    TAX_AMOUNT_BEFORE_DISCOUNT, 
    DISCOUNT_AMOUNT, 
    LINE_TOTAL, 
    LINE_TOTAL_WITH_DISCOUNT, 
    LINE_TOTAL_INCL_TAX, 
    LINE_TOTAL_WITH_DISCOUNT_INCL_TAX, 
    VARIANT_GROUP_ID, 
    VARIANT_OPTIONS, 
    PRODUCT_CUSTOM_OPTIONS, 
    REQUESTED_DATA
) 
VALUES (
    1,                       -- ORDER_ITEM_ORDER_ID
    1,                       -- PRODUCT_ID
    'PROD1',                 -- PRODUCT_SKU
    'Laptop',                -- PRODUCT_NAME
    3,                       -- QTY
    999.99,                  -- PRODUCT_PRICE
    999.99,                  -- PRODUCT_PRICE_INCL_TAX
    2999.97,                 -- FINAL_PRICE (3 * 999.99)
    2999.97,                 -- FINAL_PRICE_INCL_TAX
    10.00,                   -- TAX_PERCENT
    300.00,                  -- TAX_AMOUNT
    250.00,                  -- TAX_AMOUNT_BEFORE_DISCOUNT
    50.00,                   -- DISCOUNT_AMOUNT
    2999.97,                 -- LINE_TOTAL
    2999.97,                 -- LINE_TOTAL_WITH_DISCOUNT
    3299.97,                 -- LINE_TOTAL_INCL_TAX (after tax)
    3299.97,                 -- LINE_TOTAL_WITH_DISCOUNT_INCL_TAX
    NULL,                    -- VARIANT_GROUP_ID (or provide value)
    NULL,                    -- VARIANT_OPTIONS (or provide value)
    NULL,                    -- PRODUCT_CUSTOM_OPTIONS (or provide value)
    NULL                     -- REQUESTED_DATA (or provide value)
);


-- Insert a sample product with the required values
INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT (
    PRODUCT_ID,
    SKU, 
    PRICE, 
    STATUS, 
    QTY
    
) 
VALUES (
     1,
    'PROD1',    -- SKU
    999.99,     -- Price
    TRUE,       -- Status (TRUE means the product is active and manages stock)
    100     -- Quantity (Initial stock)
    
);


CALL EVERSHOP_COPY.PUBLIC.REDUCE_PRODUCT_STOCK_ON_ORDER(1, 2);

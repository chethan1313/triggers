file name=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\checkout\migration\Version-1.0.2.js

line=6-31

CREATE OR REPLACE PROCEDURE REDUCE_PRODUCT_STOCK_ON_ORDER1(
    PRODUCT_ID STRING,  
    QTY STRING         
)
RETURNS STRING
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS $$
try {
    var productId = Number(PRODUCT_ID);
    var orderQty = Number(QTY);

    // Start transaction
    snowflake.execute({ sqlText: `BEGIN TRANSACTION;` });

    // Check if the product exists and manages stock
    var checkStmt = snowflake.createStatement({
        sqlText: `
            SELECT QTY, MANAGE_STOCK 
            FROM EVERSHOP_COPY.PUBLIC.PRODUCT_INVENTORY 
            WHERE PRODUCT_INVENTORY_PRODUCT_ID = ?;`,
        binds: [productId]
    });
    var checkResult = checkStmt.execute();

    if (!checkResult.next()) {
        throw `Error: Product ID ${productId} does not exist.`;
    }

    var currentStock = checkResult.getColumnValue(1);
    var managesStock = checkResult.getColumnValue(2);

    // Ensure the product manages stock
    if (!managesStock) {
        throw `Error: Product ID ${productId} does not manage stock.`;
    }

    // Check if enough stock is available
    if (currentStock < orderQty) {
        throw `Error: Insufficient stock for Product ID ${productId}. Available: ${currentStock}, Requested: ${orderQty}`;
    }

    // Reduce stock and update availability
    var updateStmt = snowflake.createStatement({
        sqlText: `
            UPDATE EVERSHOP_COPY.PUBLIC.PRODUCT_INVENTORY 
            SET QTY = QTY - ?, 
                STOCK_AVAILABILITY = CASE WHEN QTY - ? > 0 THEN TRUE ELSE FALSE END
            WHERE PRODUCT_INVENTORY_PRODUCT_ID = ?;`,
        binds: [orderQty, orderQty, productId]
    });

    var updateResult = updateStmt.execute();

    if (updateResult.getRowCount() === 0) {
        throw `Error: Failed to update stock for Product ID ${productId}.`;
    }

    // Commit transaction
    snowflake.execute({ sqlText: `COMMIT;` });

    return `Success: Stock reduced for Product ID ${productId}. New stock: ${currentStock - orderQty}`;
} catch (err) {
    snowflake.execute({ sqlText: `ROLLBACK;` });
    return err;
}
$$;



INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT_INVENTORY (PRODUCT_INVENTORY_PRODUCT_ID, QTY, MANAGE_STOCK, STOCK_AVAILABILITY) 
VALUES 
    (101, 50, TRUE, TRUE),  -- Product with stock
    (102, 10, TRUE, TRUE),  -- Product with low stock
    (103, 0, TRUE, FALSE),  -- Out-of-stock product
    (104, 30, FALSE, TRUE); -- Product that does NOT manage stock


INSERT INTO EVERSHOP_COPY.PUBLIC.ORDER_ITEM (
    ORDER_ITEM_ORDER_ID, PRODUCT_ID, PRODUCT_SKU, PRODUCT_NAME, QTY, 
    PRODUCT_PRICE, PRODUCT_PRICE_INCL_TAX, FINAL_PRICE, FINAL_PRICE_INCL_TAX, 
    TAX_PERCENT, TAX_AMOUNT, TAX_AMOUNT_BEFORE_DISCOUNT, DISCOUNT_AMOUNT, 
    LINE_TOTAL, LINE_TOTAL_WITH_DISCOUNT, LINE_TOTAL_INCL_TAX, 
    LINE_TOTAL_WITH_DISCOUNT_INCL_TAX
) 
VALUES 
    (201, 101, 'SKU-101', 'Product A', 5, 20.00, 22.00, 100.00, 110.00, 
     10.00, 10.00, 10.00, 5.00, 100.00, 95.00, 110.00, 105.00),
    
    (202, 102, 'SKU-102', 'Product B', 2, 50.00, 55.00, 100.00, 110.00, 
     5.00, 5.00, 5.00, 2.00, 100.00, 98.00, 110.00, 108.00);


CALL REDUCE_PRODUCT_STOCK_ON_ORDER1('101', '5'); -- Should succeed
CALL REDUCE_PRODUCT_STOCK_ON_ORDER1('102', '2'); -- Should succeed
CALL REDUCE_PRODUCT_STOCK_ON_ORDER1('103', '1'); -- Should fail (Insufficient stock)
CALL REDUCE_PRODUCT_STOCK_ON_ORDER1('104', '3'); -- Should fail (Does not manage stock)

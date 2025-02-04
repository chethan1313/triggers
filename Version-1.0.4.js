file name=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.4.js

line=6-24

CREATE OR REPLACE PROCEDURE update_product_inventory(
    PRODUCT_ID STRING, 
    NEW_QUANTITY STRING
)
RETURNS STRING
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS $$
try {
    // Start transaction
    snowflake.execute({ sqlText: `BEGIN TRANSACTION;` });

    // 1. Check if product exists
    var checkStmt = snowflake.createStatement({
        sqlText: `SELECT COUNT(*) FROM EVERSHOP_COPY.PUBLIC.PRODUCT_INVENTORY 
                  WHERE PRODUCT_INVENTORY_PRODUCT_ID = ?;`,
        binds: [PRODUCT_ID]
    });
    var checkResult = checkStmt.execute();
    checkResult.next();
    var productExists = checkResult.getColumnValue(1);

    if (productExists === 0) {
        throw "Product not found";
    }

    // 2. Retrieve old data
    var oldStmt = snowflake.createStatement({
        sqlText: `SELECT PRODUCT_INVENTORY_PRODUCT_ID, QTY, MANAGE_STOCK, STOCK_AVAILABILITY 
                  FROM EVERSHOP_COPY.PUBLIC.PRODUCT_INVENTORY 
                  WHERE PRODUCT_INVENTORY_PRODUCT_ID = ?;`,
        binds: [PRODUCT_ID]
    });
    var oldResult = oldStmt.execute();
    oldResult.next();

    var oldData = {
        product_id: oldResult.getColumnValue(1),
        quantity: oldResult.getColumnValue(2),
        manage_stock: oldResult.getColumnValue(3) ? 1 : 0,  // Convert boolean to 1/0
        stock_availability: oldResult.getColumnValue(4) ? 1 : 0  // Convert boolean to 1/0
    };

    // 3. Update quantity
    var updateStmt = snowflake.createStatement({
        sqlText: `UPDATE EVERSHOP_COPY.PUBLIC.PRODUCT_INVENTORY 
                  SET QTY = ? 
                  WHERE PRODUCT_INVENTORY_PRODUCT_ID = ?;`,
        binds: [NEW_QUANTITY, PRODUCT_ID]
    });
    updateStmt.execute();

    // 4. Retrieve new data
    var newStmt = snowflake.createStatement({
        sqlText: `SELECT PRODUCT_INVENTORY_PRODUCT_ID, QTY, MANAGE_STOCK, STOCK_AVAILABILITY 
                  FROM EVERSHOP_COPY.PUBLIC.PRODUCT_INVENTORY 
                  WHERE PRODUCT_INVENTORY_PRODUCT_ID = ?;`,
        binds: [PRODUCT_ID]
    });
    var newResult = newStmt.execute();
    newResult.next();

    var newData = {
        product_id: newResult.getColumnValue(1),
        quantity: newResult.getColumnValue(2),
        manage_stock: newResult.getColumnValue(3) ? 1 : 0,  // Convert boolean to 1/0
        stock_availability: newResult.getColumnValue(4) ? 1 : 0  // Convert boolean to 1/0
    };

    // 5. Insert event using OBJECT_CONSTRUCT for old and new data
     var eventData = {
        old: oldData,
        new: newData
    };
    var eventDataJson = JSON.stringify(eventData);

    // Insert event using PARSE_JSON
    var eventStmt = snowflake.createStatement({
        sqlText: `
            INSERT INTO EVERSHOP_COPY.PUBLIC.EVENT (NAME, DATA)
            SELECT 
                'inventory_updated', 
                PARSE_JSON(:1)
        `,
        binds: [eventDataJson]
    });
    eventStmt.execute();

    // Commit transaction
    snowflake.execute({ sqlText: `COMMIT;` });
    return "Update successful with event logged.";
} catch (err) {
    // Rollback on error
    snowflake.execute({ sqlText: `ROLLBACK;` });
    return "Error: " + err;
}
$$;



INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT_INVENTORY 
    (PRODUCT_INVENTORY_PRODUCT_ID, QTY, MANAGE_STOCK, STOCK_AVAILABILITY) 
VALUES 
    (1001, 50, TRUE, TRUE),
    (1002, 30, TRUE, TRUE),
    (1003, 0, FALSE, FALSE),
    (1004, 75, TRUE, TRUE),
    (1005, 20, FALSE, TRUE);


CALL update_product_inventory('1002', '80');

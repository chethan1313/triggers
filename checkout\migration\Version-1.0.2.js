file name=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\checkout\migration\Version-1.0.2.js

line=6-31

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.INSERT_ORDER_ITEM_AND_UPDATE_PRODUCT_INVENTORY(
    DATA_JSON VARIANT  -- JSON with key-value pairs for fields to insert into ORDER_ITEM
)
RETURNS STRING
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // --- 1. Build and execute the INSERT into ORDER_ITEM ---
    var data = DATA_JSON;
    var columns = [];
    var values = [];
    
    for (var key in data) {
        columns.push(key);
        var val = data[key];
        if (typeof val === 'string') {
            // Escape single quotes in string values.
            val = val.replace(/'/g, "''");
            values.push("'" + val + "'");
        } else if (typeof val === 'boolean') {
            values.push(val ? "TRUE" : "FALSE");
        } else if (val === null) {
            values.push("NULL");
        } else {
            values.push(val.toString());
        }
    }
    
    var insertQuery = "INSERT INTO EVERSHOP_COPY.PUBLIC.ORDER_ITEM (" 
                      + columns.join(", ") 
                      + ") VALUES (" 
                      + values.join(", ") 
                      + ")";
    
    var stmtInsert = snowflake.createStatement({ sqlText: insertQuery });
    stmtInsert.execute();
    
    // --- 2. Retrieve the newly inserted ORDER_ITEM row ---
    // (Assuming no concurrent inserts, we pick the row with the highest ORDER_ITEM_ID)
    var selectQuery = "SELECT * FROM EVERSHOP_COPY.PUBLIC.ORDER_ITEM ORDER BY ORDER_ITEM_ID DESC LIMIT 1";
    var stmtSelect = snowflake.createStatement({ sqlText: selectQuery });
    var resultSelect = stmtSelect.execute();
    
    if (!resultSelect.next()) {
        throw "No inserted order item found.";
    }
    
    var insertedRow = {};
    var colCount = resultSelect.getColumnCount();
    for (var i = 1; i <= colCount; i++) {
        var colName = resultSelect.getColumnName(i);
        insertedRow[colName] = resultSelect.getColumnValue(i);
    }
    
    // --- 3. Update the PRODUCT_INVENTORY table ---
    // Extract the PRODUCT_ID and order QTY from the inserted order item.
    var prodId = insertedRow["PRODUCT_ID"];
    var orderQty = insertedRow["QTY"];
    
    if (prodId === null || orderQty === null) {
        throw "Inserted order item does not have PRODUCT_ID or QTY.";
    }
    
    var updateQuery = "UPDATE EVERSHOP_COPY.PUBLIC.PRODUCT_INVENTORY SET QTY = QTY - " 
                      + orderQty 
                      + " WHERE PRODUCT_INVENTORY_PRODUCT_ID = " + prodId 
                      + " AND MANAGE_STOCK = TRUE";
    var stmtUpdate = snowflake.createStatement({ sqlText: updateQuery });
    stmtUpdate.execute();
    
    // --- 4. Return the PRODUCT_ID ---
    return prodId;
} catch (err) {
    throw "Error: " + err;
}
$$;



INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT_INVENTORY (
    PRODUCT_INVENTORY_PRODUCT_ID, QTY, MANAGE_STOCK, STOCK_AVAILABILITY
)
VALUES (101, 50, TRUE, FALSE);


CALL EVERSHOP_COPY.PUBLIC.INSERT_ORDER_ITEM_AND_UPDATE_PRODUCT_INVENTORY(
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

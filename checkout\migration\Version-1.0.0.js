filename=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\checkout\migration\Version-1.0.0.js

line=271-290

C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\checkout\services\orderCreator.js
172

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.INSERT_ORDER_ITEM_AND_UPDATE_PRODUCT(
    DATA_JSON VARIANT  -- JSON with key-value pairs for fields to insert into ORDER_ITEM
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // --- 1. Insert a new order item into ORDER_ITEM ---
    var data = DATA_JSON;
    var columns = [];
    var values = [];
    
    // Build column names and values from the JSON object.
    for (var key in data) {
        columns.push(key);
        var val = data[key];
        if (typeof val === 'string') {
            // Escape any single quotes.
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
    
    // --- 2. Retrieve the newly inserted order item ---
    // (Assuming no concurrent inserts, we select the row with the highest ORDER_ITEM_ID.)
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
    
    // --- 3. Update the PRODUCT table stock ---
    // Extract PRODUCT_ID and QTY from the inserted order item.
    var prodId = insertedRow["PRODUCT_ID"];
    var orderQty = insertedRow["QTY"];
    
    if (prodId === null || orderQty === null) {
        throw "Inserted order item does not have PRODUCT_ID or QTY.";
    }
    
    // Update the product's quantity by subtracting the ordered quantity.
    var updateProductQuery = "UPDATE EVERSHOP_COPY.PUBLIC.PRODUCT SET QTY = QTY - " 
                             + orderQty 
                             + " WHERE PRODUCT_ID = " + prodId;
    var stmtUpdateProd = snowflake.createStatement({ sqlText: updateProductQuery });
    stmtUpdateProd.execute();
    
    // --- 4. Return the inserted order item as a VARIANT ---
    return prodId ;
} catch (err) {
    return "Error: " + err;
}
$$;



INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT (
    SKU,
    PRICE,
    QTY,
    TYPE,
    STATUS
)
VALUES (
    'SKU-101',
    100.00,
    50,         -- initial stock quantity
    'simple',
    TRUE
);


CALL EVERSHOP_COPY.PUBLIC.INSERT_ORDER_ITEM_AND_UPDATE_PRODUCT(
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


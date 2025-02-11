filename=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.6.js

line=26-44

C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.6.js
60
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\product\createProduct.js
154
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\product\updateProduct.js
239

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.INSERT_PRODUCT_IMAGE_WITH_EVENT(
    DATA_JSON VARIANT  -- JSON with key-value pairs for fields to insert into PRODUCT_IMAGE
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // --- 1. Build the INSERT statement dynamically ---
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
    
    // Build the INSERT query (without a RETURNING clause).
    var insertQuery = "INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT_IMAGE (" 
                      + columns.join(", ") 
                      + ") VALUES (" 
                      + values.join(", ") 
                      + ")";
    
    var stmtInsert = snowflake.createStatement({ sqlText: insertQuery });
    stmtInsert.execute();
    
    // --- 2. Retrieve the inserted row ---
    // For retrieval, we assume the input JSON contains PRODUCT_IMAGE_PRODUCT_ID.
    if (!data.hasOwnProperty("PRODUCT_IMAGE_PRODUCT_ID")) {
        throw "Input JSON must include PRODUCT_IMAGE_PRODUCT_ID for retrieval.";
    }
    var prodId = data.PRODUCT_IMAGE_PRODUCT_ID;
    // Retrieve the row with the highest PRODUCT_IMAGE_ID for this product.
    var selectQuery = "SELECT * FROM EVERSHOP_COPY.PUBLIC.PRODUCT_IMAGE " +
                      "WHERE PRODUCT_IMAGE_PRODUCT_ID = " + prodId +
                      " ORDER BY PRODUCT_IMAGE_ID DESC LIMIT 1";
    var stmtSelect = snowflake.createStatement({ sqlText: selectQuery });
    var resultSelect = stmtSelect.execute();
    
    if (!resultSelect.next()) {
        throw "No inserted row found.";
    }
    
    var insertedRow = {};
    var colCount = resultSelect.getColumnCount();
    for (var i = 1; i <= colCount; i++) {
        var colName = resultSelect.getColumnName(i);
        insertedRow[colName] = resultSelect.getColumnValue(i);
    }
    
    // --- 3. Log the event in the EVENT table ---
    // Use the inserted row as the event data.
    var eventDataStr = JSON.stringify(insertedRow);
    // Escape any single quotes for safe SQL insertion.
    eventDataStr = eventDataStr.replace(/'/g, "''");
    
    // Build the INSERT for EVENT using a SELECT clause with PARSE_JSON.
    var eventInsertQuery = "INSERT INTO EVERSHOP_COPY.PUBLIC.EVENT (NAME, DATA) " +
                           "SELECT 'product_image_added', PARSE_JSON('" + eventDataStr + "')";
    var stmtEvent = snowflake.createStatement({ sqlText: eventInsertQuery });
    stmtEvent.execute();
    
    // --- 4. Return the inserted row as a VARIANT ---
    return JSON.parse(JSON.stringify(insertedRow));
} catch (err) {
    return "Error: " + err;
}
$$;


CALL EVERSHOP_COPY.PUBLIC.INSERT_PRODUCT_IMAGE_WITH_EVENT(
    PARSE_JSON('{
        "PRODUCT_IMAGE_PRODUCT_ID": 101,
        "ORIGIN_IMAGE": "origin.jpg",
        "THUMB_IMAGE": "thumb.jpg",
        "LISTING_IMAGE": "listing.jpg",
        "SINGLE_IMAGE": "single.jpg",
        "IS_MAIN": false
    }')
);

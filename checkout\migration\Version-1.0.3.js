filename=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\checkout\migration\Version-1.0.3.js

line=6-24

C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\checkout\services\orderCreator.js
150



CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.INSERT_SALES_ORDER_WITH_EVENT(
    DATA_JSON VARIANT  -- JSON with key-value pairs for fields to insert into SALES_ORDER
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // --- 1. Build the INSERT statement dynamically for SALES_ORDER ---
    var data = DATA_JSON;
    var columns = [];
    var values = [];
    
    for (var key in data) {
        columns.push(key);
        var val = data[key];
        if (typeof val === 'string') {
            // Escape single quotes.
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
    
    var insertQuery = "INSERT INTO EVERSHOP_COPY.PUBLIC.SALES_ORDER (" 
                      + columns.join(", ") 
                      + ") VALUES (" 
                      + values.join(", ") 
                      + ")";
    
    var stmtInsert = snowflake.createStatement({ sqlText: insertQuery });
    stmtInsert.execute();
    
    // --- 2. Retrieve the newly inserted order ---
    // (Assuming no concurrent inserts, we select the row with the highest ORDER_ID)
    var selectQuery = "SELECT * FROM EVERSHOP_COPY.PUBLIC.SALES_ORDER ORDER BY ORDER_ID DESC LIMIT 1";
    var stmtSelect = snowflake.createStatement({ sqlText: selectQuery });
    var resultSelect = stmtSelect.execute();
    
    if (!resultSelect.next()) {
        throw "No inserted order found.";
    }
    
    var insertedRow = {};
    var colCount = resultSelect.getColumnCount();
    for (var i = 1; i <= colCount; i++) {
        var colName = resultSelect.getColumnName(i);
        insertedRow[colName] = resultSelect.getColumnValue(i);
    }
    
    // --- 3. Log the event into the EVENT table ---
    // Convert the inserted row into a JSON string.
    var eventDataStr = JSON.stringify(insertedRow);
    // Escape any single quotes so that it can be safely inlined.
    eventDataStr = eventDataStr.replace(/'/g, "''");
    
    var eventInsertQuery = "INSERT INTO EVERSHOP_COPY.PUBLIC.EVENT (NAME, DATA) " +
                           "SELECT 'order_created', PARSE_JSON('" + eventDataStr + "')";
    
    var stmtEvent = snowflake.createStatement({ sqlText: eventInsertQuery });
    stmtEvent.execute();
    
    // --- 4. Return the inserted order as a VARIANT ---
    return JSON.parse(JSON.stringify(insertedRow));
} catch (err) {
    return "Error: " + err;
}
$$;

CALL EVERSHOP_COPY.PUBLIC.INSERT_SALES_ORDER_WITH_EVENT(
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


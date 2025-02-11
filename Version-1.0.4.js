file name=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.4.js

line=6-24

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.UPDATE_PRODUCT_INVENTORY_WITH_EVENT(
    DATA_JSON VARIANT,   -- JSON with update field-value pairs
    WHERE_JSON VARIANT   -- JSON with a key "where" containing the WHERE clause (e.g., {"where": "PRODUCT_INVENTORY_ID = 101"})
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // Validate and extract the WHERE clause.
    var whereClause = (WHERE_JSON && WHERE_JSON.where) ? WHERE_JSON.where : null;
    if (!whereClause) {
        throw "WHERE clause is required for update.";
    }
    
    // --- 1. Retrieve the OLD row ---
    var selectOldQuery = "SELECT * FROM EVERSHOP_COPY.PUBLIC.PRODUCT_INVENTORY WHERE " + whereClause;
    var stmtOld = snowflake.createStatement({ sqlText: selectOldQuery });
    var resultOld = stmtOld.execute();
    if (!resultOld.next()) {
        throw "No matching row found for update.";
    }
    var oldRow = {};
    var colCount = resultOld.getColumnCount();
    for (var i = 1; i <= colCount; i++) {
        var colName = resultOld.getColumnName(i);
        oldRow[colName] = resultOld.getColumnValue(i);
    }
    
    // --- 2. Perform the UPDATE ---
    var data = DATA_JSON;
    var setClauses = [];
    for (var key in data) {
        var val = data[key];
        if (typeof val === 'string') {
            val = val.replace(/'/g, "''");
            setClauses.push(key + " = '" + val + "'");
        } else if (typeof val === 'boolean') {
            setClauses.push(key + " = " + (val ? 'TRUE' : 'FALSE'));
        } else if (val === null) {
            setClauses.push(key + " = NULL");
        } else {
            setClauses.push(key + " = " + val.toString());
        }
    }
    var updateQuery = "UPDATE EVERSHOP_COPY.PUBLIC.PRODUCT_INVENTORY SET " 
                      + setClauses.join(", ") 
                      + " WHERE " + whereClause;
    var stmtUpdate = snowflake.createStatement({ sqlText: updateQuery });
    stmtUpdate.execute();
    
    // --- 3. Retrieve the NEW row ---
    var selectNewQuery = "SELECT * FROM EVERSHOP_COPY.PUBLIC.PRODUCT_INVENTORY WHERE " + whereClause;
    var stmtNew = snowflake.createStatement({ sqlText: selectNewQuery });
    var resultNew = stmtNew.execute();
    if (!resultNew.next()) {
        throw "Unable to retrieve updated row.";
    }
    var newRow = {};
    var colCountNew = resultNew.getColumnCount();
    for (var i = 1; i <= colCountNew; i++) {
        var colNameNew = resultNew.getColumnName(i);
        newRow[colNameNew] = resultNew.getColumnValue(i);
    }
    
    // --- 4. Insert an event record into the EVENT table ---
    // Construct event data as a JavaScript object.
    var eventData = {
        old: oldRow,
        new: newRow
    };
    // Convert the event data object to a JSON string.
    var eventDataStr = JSON.stringify(eventData);
    // Escape any single quotes in the JSON string.
    eventDataStr = eventDataStr.replace(/'/g, "''");
    
    // Construct the INSERT statement using a SELECT clause with PARSE_JSON.
    var insertEventQuery = "INSERT INTO EVERSHOP_COPY.PUBLIC.EVENT (NAME, DATA) " +
                           "SELECT 'inventory_updated', PARSE_JSON('" + eventDataStr + "')";
    var stmtEvent = snowflake.createStatement({ sqlText: insertEventQuery });
    stmtEvent.execute();
    
    // --- 5. Return the updated (NEW) row as a VARIANT ---
    // Use JavaScript's JSON.parse to convert the stringified newRow into an object.
    return JSON.parse(JSON.stringify(newRow));
} catch(err) {
    return "Error: " + err;
}
$$;


INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT_INVENTORY (
    PRODUCT_INVENTORY_PRODUCT_ID, QTY, MANAGE_STOCK, STOCK_AVAILABILITY
)
VALUES (101, 50, TRUE, FALSE);


CALL EVERSHOP_COPY.PUBLIC.UPDATE_PRODUCT_INVENTORY_WITH_EVENT(
    PARSE_JSON('{
        "QTY": 45,
        "STOCK_AVAILABILITY": true
    }'),
    PARSE_JSON('{ "where": "PRODUCT_INVENTORY_ID = 203" }')
);

FILENAME=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\migration\Version-1.0.1.js

line=6=66

update+++++++++
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\api\updateCustomer\updateCustomer.js
41
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\services\customer\updatePassword.js
18
delete++++++++++
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\pages\frontStore\all\[context]auth.js
30
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\services\customer\deleteCustomer.js
14
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\services\customer\updateCustomer.js
55
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\services\customer\loginCustomerWithEmail.js
28
insert++++++++++
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\services\customer\createCustomer.js
45


for inserting while creating customer 

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.INSERT_CUSTOMER_WITH_EVENT(
    DATA_JSON VARIANT  -- JSON with key-value pairs for fields to insert into CUSTOMER
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // --- 1. Build the INSERT statement dynamically for CUSTOMER ---
    var data = DATA_JSON;
    var columns = [];
    var values = [];
    
    // Loop through the keys in the JSON object to build column names and values.
    for (var key in data) {
        columns.push(key);
        var val = data[key];
        if (typeof val === 'string') {
            // Escape any single quotes in string values.
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
    
    var insertSQL = "INSERT INTO EVERSHOP_COPY.PUBLIC.CUSTOMER (" 
                  + columns.join(", ") 
                  + ") VALUES (" 
                  + values.join(", ") 
                  + ")";
    
    var stmtInsert = snowflake.createStatement({ sqlText: insertSQL });
    stmtInsert.execute();
    
    // --- 2. Retrieve the newly inserted CUSTOMER row ---
    // (Assumes no concurrent inserts; select the row with the highest CUSTOMER_ID)
    var selectSQL = "SELECT * FROM EVERSHOP_COPY.PUBLIC.CUSTOMER ORDER BY CUSTOMER_ID DESC LIMIT 1";
    var stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    var result = stmtSelect.execute();
    
    if (!result.next()) {
        throw "No inserted customer found.";
    }
    
    var insertedRow = {};
    var colCount = result.getColumnCount();
    for (var i = 1; i <= colCount; i++) {
        var colName = result.getColumnName(i);
        insertedRow[colName] = result.getColumnValue(i);
    }
    
    // --- 3. Log an event in the EVENT table ---
    // Convert the inserted row to a JSON string.
    var eventDataStr = JSON.stringify(insertedRow);
    // Escape single quotes in the JSON string for safe inlining.
    eventDataStr = eventDataStr.replace(/'/g, "''");
    
    // Build the INSERT statement for the EVENT table using a SELECT clause.
    var eventSQL = "INSERT INTO EVERSHOP_COPY.PUBLIC.EVENT (NAME, DATA) " +
                   "SELECT 'customer_created', PARSE_JSON('" + eventDataStr + "')";
    
    var stmtEvent = snowflake.createStatement({ sqlText: eventSQL });
    stmtEvent.execute();
    
    // --- 4. Return the inserted customer row as a VARIANT (mimicking RETURN NEW) ---
    return JSON.parse(JSON.stringify(insertedRow));
    
} catch (err) {
    return "Error: " + err;
}
$$;

CALL EVERSHOP_COPY.PUBLIC.INSERT_CUSTOMER_WITH_EVENT(
    PARSE_JSON('{
        "EMAIL": "john.doe@example.com",
        "PASSWORD": "secretPassword",
        "FULL_NAME": "John Doe"
    }')
);


for inserting into event while updating the customer _________________________________________________________________________

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.UPDATE_CUSTOMER_WITH_EVENT(
    DATA_JSON VARIANT,   -- JSON with key-value pairs for fields to update in CUSTOMER
    WHERE_JSON VARIANT   -- JSON with a key "where" containing the WHERE clause (e.g., {"where": "CUSTOMER_ID = 101"})
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // 1. Extract and validate the WHERE clause.
    var whereClause = (WHERE_JSON && WHERE_JSON.where) ? WHERE_JSON.where : null;
    if (!whereClause) {
        throw "WHERE clause is required for update.";
    }
    
    // 2. Build the UPDATE statement dynamically.
    var data = DATA_JSON;
    var setClauses = [];
    for (var key in data) {
        var val = data[key];
        if (typeof val === 'string') {
            // Escape single quotes.
            val = val.replace(/'/g, "''");
            setClauses.push(key + " = '" + val + "'");
        } else if (typeof val === 'boolean') {
            setClauses.push(key + " = " + (val ? "TRUE" : "FALSE"));
        } else if (val === null) {
            setClauses.push(key + " = NULL");
        } else {
            setClauses.push(key + " = " + val.toString());
        }
    }
    
    var updateSQL = "UPDATE EVERSHOP_COPY.PUBLIC.CUSTOMER SET " 
                    + setClauses.join(", ") 
                    + " WHERE " + whereClause;
                    
    var stmtUpdate = snowflake.createStatement({ sqlText: updateSQL });
    stmtUpdate.execute();
    
    // 3. Retrieve the updated customer row.
    var selectSQL = "SELECT * FROM EVERSHOP_COPY.PUBLIC.CUSTOMER WHERE " + whereClause;
    var stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    var resultSelect = stmtSelect.execute();
    
    if (!resultSelect.next()) {
        throw "No customer found for the given WHERE clause.";
    }
    
    var updatedRow = {};
    var colCount = resultSelect.getColumnCount();
    for (var i = 1; i <= colCount; i++) {
        var colName = resultSelect.getColumnName(i);
        updatedRow[colName] = resultSelect.getColumnValue(i);
    }
    
    // 4. Log the customer_updated event.
    // Convert the updated row to a JSON string.
    var eventDataStr = JSON.stringify(updatedRow);
    // Escape any single quotes for safe inlining.
    eventDataStr = eventDataStr.replace(/'/g, "''");
    
    var eventSQL = "INSERT INTO EVERSHOP_COPY.PUBLIC.EVENT (NAME, DATA) " +
                   "SELECT 'customer_updated', PARSE_JSON('" + eventDataStr + "')";
                   
    var stmtEvent = snowflake.createStatement({ sqlText: eventSQL });
    stmtEvent.execute();
    
    // 5. Return the updated customer row as a VARIANT.
    return JSON.parse(JSON.stringify(updatedRow));
} catch (err) {
    return "Error: " + err;
}
$$;


CALL EVERSHOP_COPY.PUBLIC.UPDATE_CUSTOMER_WITH_EVENT(
    PARSE_JSON('{
        "EMAIL": "new.email@example.com",
        "FULL_NAME": "New Customer Name"
    }'),
    PARSE_JSON('{ "where": "CUSTOMER_ID = 301" }')
);


for inserting while deleting the customer_______________________________________________________________________________________

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.DELETE_CUSTOMER_AND_LOG_EVENT(
    WHERE_JSON VARIANT  -- JSON with key "where": complete WHERE clause for deletion, e.g. {"where": "CUSTOMER_ID = 5"}
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // 1. Extract the WHERE clause from the input JSON.
    var whereClause = (WHERE_JSON && WHERE_JSON.where) ? WHERE_JSON.where : null;
    if (!whereClause) {
        throw "WHERE clause is required for deletion.";
    }
    
    // 2. Retrieve rows to be deleted.
    var selectSQL = "SELECT * FROM EVERSHOP_COPY.PUBLIC.CUSTOMER WHERE " + whereClause;
    var stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    var result = stmtSelect.execute();
    
    var rowsToDelete = [];
    while(result.next()){
        var row = {};
        var colCount = result.getColumnCount();
        for(var i = 1; i <= colCount; i++){
            var colName = result.getColumnName(i);
            row[colName] = result.getColumnValue(i);
        }
        rowsToDelete.push(row);
    }
    
    if (rowsToDelete.length === 0) {
        throw "No customer found for the given WHERE clause.";
    }
    
    // 3. For each row, log an event in the EVENT table.
    for (var j = 0; j < rowsToDelete.length; j++) {
        var rowDataStr = JSON.stringify(rowsToDelete[j]);
        // Escape any single quotes for safe inlining.
        rowDataStr = rowDataStr.replace(/'/g, "''");
        var eventSQL = "INSERT INTO EVERSHOP_COPY.PUBLIC.EVENT (NAME, DATA) " +
                       "SELECT 'customer_deleted', PARSE_JSON('" + rowDataStr + "')";
        var stmtEvent = snowflake.createStatement({ sqlText: eventSQL });
        stmtEvent.execute();
    }
    
    // 4. Delete the rows from the CUSTOMER table.
    var deleteSQL = "DELETE FROM EVERSHOP_COPY.PUBLIC.CUSTOMER WHERE " + whereClause;
    var stmtDelete = snowflake.createStatement({ sqlText: deleteSQL });
    stmtDelete.execute();
    
    // 5. Return the deleted rows as a VARIANT (JSON array).
    return PARSE_JSON(JSON.stringify(rowsToDelete));
    
} catch (err) {
    return "Error: " + err;
}
$$;

CALL EVERSHOP_COPY.PUBLIC.DELETE_CUSTOMER_AND_LOG_EVENT(
    PARSE_JSON('{ "where": "CUSTOMER_ID = 401" }')
);


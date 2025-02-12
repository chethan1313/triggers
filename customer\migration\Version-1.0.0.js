filename=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\migration\Version-1.0.0.js

line=72-92

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.DELETE_CUSTOMER_GROUP(
    WHERE_JSON VARIANT  -- JSON with a key "where" containing the full WHERE clause (e.g. {"where": "CUSTOMER_GROUP_ID = 5"})
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // Extract the WHERE clause from the input JSON.
    var whereClause = (WHERE_JSON && WHERE_JSON.where) ? WHERE_JSON.where : null;
    if (!whereClause) {
        throw "WHERE clause is required for deletion.";
    }
    
    // --- 1. Retrieve the rows that match the WHERE clause ---
    var selectQuery = "SELECT * FROM EVERSHOP_COPY.PUBLIC.CUSTOMER_GROUP WHERE " + whereClause;
    var stmtSelect = snowflake.createStatement({ sqlText: selectQuery });
    var result = stmtSelect.execute();
    
    // Check if any rows were found.
    if (!result.next()) {
        throw "No customer group found for the given WHERE clause.";
    }
    
    // Collect rows that are about to be deleted.
    var rowsToDelete = [];
    do {
        var row = {};
        var colCount = result.getColumnCount();
        for (var i = 1; i <= colCount; i++) {
            var colName = result.getColumnName(i);
            row[colName] = result.getColumnValue(i);
        }
        // Check if this is the default customer group.
        if (row["CUSTOMER_GROUP_ID"] == 1) {
            throw "Cannot delete default customer group";
        }
        rowsToDelete.push(row);
    } while (result.next());
    
    // --- 2. Perform the DELETE ---
    var deleteQuery = "DELETE FROM EVERSHOP_COPY.PUBLIC.CUSTOMER_GROUP WHERE " + whereClause;
    var stmtDelete = snowflake.createStatement({ sqlText: deleteQuery });
    stmtDelete.execute();
    
    // --- 3. Return the details of the deleted rows ---
    return PARSE_JSON(JSON.stringify(rowsToDelete));
} catch (err) {
    return "Error: " + err;
}
$$;


CALL EVERSHOP_COPY.PUBLIC.DELETE_CUSTOMER_GROUP(
    PARSE_JSON('{ "where": "CUSTOMER_GROUP_ID = 101" }')
);


****************************************************************************************************************

  line=95-116

C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\services\customer\createCustomer.js
45


CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.INSERT_CUSTOMER_WITH_DEFAULT_GROUP(
    DATA_JSON VARIANT  -- JSON with key-value pairs for fields to insert into CUSTOMER
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // Parse the input JSON object.
    var data = DATA_JSON;

    // Mimic the trigger logic: if GROUP_ID is missing or null, set it to 1.
    if (!data.hasOwnProperty("GROUP_ID") || data["GROUP_ID"] === null) {
        data["GROUP_ID"] = 1;
    }
    
    // --- Build the INSERT statement dynamically ---
    var columns = [];
    var values = [];
    
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
    
    var insertQuery = "INSERT INTO EVERSHOP_COPY.PUBLIC.CUSTOMER (" 
                      + columns.join(", ") 
                      + ") VALUES (" 
                      + values.join(", ") 
                      + ")";
    
    var stmtInsert = snowflake.createStatement({ sqlText: insertQuery });
    stmtInsert.execute();
    
    // --- Retrieve the newly inserted CUSTOMER row ---
    // Assuming no concurrent inserts, select the row with the highest CUSTOMER_ID.
    var selectQuery = "SELECT * FROM EVERSHOP_COPY.PUBLIC.CUSTOMER ORDER BY CUSTOMER_ID DESC LIMIT 1";
    var stmtSelect = snowflake.createStatement({ sqlText: selectQuery });
    var resultSelect = stmtSelect.execute();
    
    if (!resultSelect.next()) {
        throw "No inserted customer found.";
    }
    
    var insertedRow = {};
    var colCount = resultSelect.getColumnCount();
    for (var i = 1; i <= colCount; i++) {
        var colName = resultSelect.getColumnName(i);
        insertedRow[colName] = resultSelect.getColumnValue(i);
    }
    
    // --- Return the inserted row as a VARIANT ---
    return JSON.parse(JSON.stringify(insertedRow));
    
} catch (err) {
    return "Error: " + err;
}
$$;


CALL EVERSHOP_COPY.PUBLIC.INSERT_CUSTOMER_WITH_DEFAULT_GROUP(
    PARSE_JSON('{
        "EMAIL": "john.doe@example.com",
        "PASSWORD": "secretPassword",
        "FULL_NAME": "John Doe",
        "GROUP_ID": null
    }')
);

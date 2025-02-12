FILENAME=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.0.js

LINE=502-686



CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.DELETE_ATTRIBUTE_GROUP_AND_LOG(
    WHERE_JSON VARIANT  -- JSON object with a key "where" containing the deletion WHERE clause, e.g. {"where": "ATTRIBUTE_GROUP_ID = 5"}
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
    
    // --- 1. Retrieve rows to be deleted ---
    var selectSQL = "SELECT * FROM EVERSHOP_COPY.PUBLIC.ATTRIBUTE_GROUP WHERE " + whereClause;
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
        // Check if this is the default attribute group.
        if(row["ATTRIBUTE_GROUP_ID"] == 1) {
            throw "Cannot delete default attribute group";
        }
        rowsToDelete.push(row);
    }
    
    if(rowsToDelete.length === 0) {
        throw "No attribute group found for the given WHERE clause.";
    }
    
    // --- 2. Delete the rows ---
    var deleteSQL = "DELETE FROM EVERSHOP_COPY.PUBLIC.ATTRIBUTE_GROUP WHERE " + whereClause;
    var stmtDelete = snowflake.createStatement({ sqlText: deleteSQL });
    stmtDelete.execute();
    
    // --- 3. Return the details of the deleted rows as a JSON array ---
    return JSON.parse(JSON.stringify(rowsToDelete));
    
} catch (err) {
    return "Error: " + err;
}
$$;

CALL EVERSHOP_COPY.PUBLIC.DELETE_ATTRIBUTE_GROUP_AND_LOG(
    PARSE_JSON('{ "where": "ATTRIBUTE_GROUP_ID = 1" }')
);  ---there as to be the row with ATTRIBUTE_GROUP_ID = 1 in the table 


*************************************************************************************************************
CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.UPDATE_PRODUCT_WITH_ATTRIBUTE_GROUP_CHECK(
    DATA_JSON VARIANT,   -- JSON with fields to update, e.g. {"GROUP_ID": 5}
    WHERE_JSON VARIANT   -- JSON with a key "where" containing the WHERE clause, e.g. {"where": "PRODUCT_ID = 101"}
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
    
    // 2. Retrieve the existing (OLD) product row.
    var selectOldSQL = "SELECT * FROM EVERSHOP_COPY.PUBLIC.PRODUCT WHERE " + whereClause;
    var stmtOld = snowflake.createStatement({ sqlText: selectOldSQL });
    var resultOld = stmtOld.execute();
    if (!resultOld.next()) { 
         throw "No product found for update."; 
    }
    var oldRow = {};
    var colCount = resultOld.getColumnCount();
    for (var i = 1; i <= colCount; i++) {
         var colName = resultOld.getColumnName(i);
         oldRow[colName] = resultOld.getColumnValue(i);
    }
    
    // 3. Create a new row by merging the old row with the update values.
    //    For any field in DATA_JSON, use the new value; otherwise, retain the old value.
    var data = DATA_JSON;
    var newRow = {};
    for (var key in oldRow) {
         newRow[key] = oldRow[key];
    }
    for (var key in data) {
         newRow[key] = data[key];
    }
    
    // 4. Check if the attribute group is being changed when variants exist.
    //    If old GROUP_ID != new GROUP_ID and old VARIANT_GROUP_ID is not null, raise an error.
    if (oldRow["GROUP_ID"] != newRow["GROUP_ID"] && oldRow["VARIANT_GROUP_ID"] !== null) {
         throw "Cannot change attribute group of product with variants";
    }
    
    // 5. Build the dynamic UPDATE statement using fields from DATA_JSON.
    var setClauses = [];
    for (var key in data) {
         var val = data[key];
         if (typeof val === "string") {
             // Escape single quotes.
             val = val.replace(/'/g, "''");
             setClauses.push(key + " = '" + val + "'");
         } else if (typeof val === "boolean") {
             setClauses.push(key + " = " + (val ? "TRUE" : "FALSE"));
         } else if (val === null) {
             setClauses.push(key + " = NULL");
         } else {
             setClauses.push(key + " = " + val.toString());
         }
    }
    
    var updateSQL = "UPDATE EVERSHOP_COPY.PUBLIC.PRODUCT SET " 
                    + setClauses.join(", ") 
                    + " WHERE " + whereClause;
    var stmtUpdate = snowflake.createStatement({ sqlText: updateSQL });
    stmtUpdate.execute();
    
    // 6. Retrieve the updated product row.
    var selectNewSQL = "SELECT * FROM EVERSHOP_COPY.PUBLIC.PRODUCT WHERE " + whereClause;
    var stmtNew = snowflake.createStatement({ sqlText: selectNewSQL });
    var resultNew = stmtNew.execute();
    if (!resultNew.next()) { 
         throw "Unable to retrieve updated product."; 
    }
    var updatedRow = {};
    var colCountNew = resultNew.getColumnCount();
    for (var i = 1; i <= colCountNew; i++) {
         var colNameNew = resultNew.getColumnName(i);
         updatedRow[colNameNew] = resultNew.getColumnValue(i);
    }
    
    // 7. Return the updated product row as a VARIANT (mimicking RETURN NEW)
    return JSON.parse(JSON.stringify(updatedRow));
    
} catch (err) {
    return "Error: " + err;
}
$$;


CALL EVERSHOP_COPY.PUBLIC.UPDATE_PRODUCT_WITH_ATTRIBUTE_GROUP_CHECK(
    PARSE_JSON('{"GROUP_ID": 3}'),
    PARSE_JSON('{"where": "PRODUCT_ID = 101"}')
);   ---DOESN'T CHANGE ATTRIBUTE GROUP


CALL EVERSHOP_COPY.PUBLIC.UPDATE_PRODUCT_WITH_ATTRIBUTE_GROUP_CHECK(
    PARSE_JSON('{"PRICE": 150.00}'),
    PARSE_JSON('{"where": "PRODUCT_ID = 101"}')
);
--CHANGES

****************************************************************************

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.DELETE_ATTRIBUTE_GROUP_LINK_CASCADE(
    WHERE_JSON VARIANT  -- JSON with key "where": e.g. { "where": "ATTRIBUTE_GROUP_LINK_ID = 1" }
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // 1. Extract the WHERE clause.
    var whereClause = (WHERE_JSON && WHERE_JSON.where) ? WHERE_JSON.where : null;
    if (!whereClause) {
        throw "WHERE clause is required for deletion.";
    }
    
    // 2. Retrieve rows to be deleted from ATTRIBUTE_GROUP_LINK.
    var selectSQL = "SELECT * FROM EVERSHOP_COPY.PUBLIC.ATTRIBUTE_GROUP_LINK WHERE " + whereClause;
    var stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    var result = stmtSelect.execute();
    
    var rowsToDelete = [];
    while (result.next()) {
        var row = {};
        var colCount = result.getColumnCount();
        for (var i = 1; i <= colCount; i++) {
            var colName = result.getColumnName(i);
            row[colName] = result.getColumnValue(i);
        }
        rowsToDelete.push(row);
    }
    
    if (rowsToDelete.length === 0) {
        throw "No rows found for deletion.";
    }
    
    // 3. For each row, perform cascading deletions.
    for (var j = 0; j < rowsToDelete.length; j++) {
        var currentRow = rowsToDelete[j];
        var attribute_id = currentRow["ATTRIBUTE_ID"];
        var group_id = currentRow["GROUP_ID"];
        
        // Delete from PRODUCT_ATTRIBUTE_VALUE_INDEX where:
        // - ATTRIBUTE_ID equals the deleted attribute, and
        // - PRODUCT_ID is in the set of products whose GROUP_ID equals the deleted row's group.
        var deleteIndexSQL = "DELETE FROM EVERSHOP_COPY.PUBLIC.PRODUCT_ATTRIBUTE_VALUE_INDEX " +
                             "WHERE ATTRIBUTE_ID = " + attribute_id +
                             " AND PRODUCT_ID IN (SELECT PRODUCT_ID FROM EVERSHOP_COPY.PUBLIC.PRODUCT WHERE GROUP_ID = " + group_id + ")";
        var stmtDeleteIndex = snowflake.createStatement({ sqlText: deleteIndexSQL });
        stmtDeleteIndex.execute();
        
        // Delete from VARIANT_GROUP where:
        // - ATTRIBUTE_GROUP_ID equals the deleted row's group, and
        // - Any of ATTRIBUTE_ONE, ATTRIBUTE_TWO, ATTRIBUTE_THREE, ATTRIBUTE_FOUR, or ATTRIBUTE_FIVE equals the deleted attribute.
        var deleteVariantSQL = "DELETE FROM EVERSHOP_COPY.PUBLIC.VARIANT_GROUP " +
                               "WHERE ATTRIBUTE_GROUP_ID = " + group_id +
                               " AND (ATTRIBUTE_ONE = " + attribute_id +
                               " OR ATTRIBUTE_TWO = " + attribute_id +
                               " OR ATTRIBUTE_THREE = " + attribute_id +
                               " OR ATTRIBUTE_FOUR = " + attribute_id +
                               " OR ATTRIBUTE_FIVE = " + attribute_id + ")";
        var stmtDeleteVariant = snowflake.createStatement({ sqlText: deleteVariantSQL });
        stmtDeleteVariant.execute();
    }
    
    // 4. Delete the rows from ATTRIBUTE_GROUP_LINK.
    var deleteSQL = "DELETE FROM EVERSHOP_COPY.PUBLIC.ATTRIBUTE_GROUP_LINK WHERE " + whereClause;
    var stmtDelete = snowflake.createStatement({ sqlText: deleteSQL });
    stmtDelete.execute();
    
    // 5. Return details of the deleted rows as a JSON array.
    return JSON.parse(JSON.stringify(rowsToDelete));
    
} catch (err) {
    return "Error: " + err;
}
$$;

-- Insert a sample attribute group link row.
INSERT INTO EVERSHOP_COPY.PUBLIC.ATTRIBUTE_GROUP_LINK (ATTRIBUTE_ID, GROUP_ID)
VALUES (101, 10);
-- Optionally, insert another row.
INSERT INTO EVERSHOP_COPY.PUBLIC.ATTRIBUTE_GROUP_LINK (ATTRIBUTE_ID, GROUP_ID)
VALUES (102, 10);


INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT_ATTRIBUTE_VALUE_INDEX (PRODUCT_ID, ATTRIBUTE_ID, OPTION_ID, OPTION_TEXT)
VALUES (1001, 101, 1, 'Option A');

INSERT INTO EVERSHOP_COPY.PUBLIC.VARIANT_GROUP (ATTRIBUTE_GROUP_ID, ATTRIBUTE_ONE, ATTRIBUTE_TWO, ATTRIBUTE_THREE, ATTRIBUTE_FOUR, ATTRIBUTE_FIVE, VISIBILITY)
VALUES (10, 101, 105, NULL, NULL, NULL, FALSE);


CALL EVERSHOP_COPY.PUBLIC.DELETE_ATTRIBUTE_GROUP_LINK_CASCADE(
    PARSE_JSON('{ "where": "ATTRIBUTE_GROUP_LINK_ID = 1" }')---base on ATTRIBUTE_GROUP_LINK_ID created while inserting
);


*************************************************************************
    
CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.UPDATE_ATTRIBUTE_OPTION_WITH_CASCADE(
    DATA_JSON VARIANT,   -- JSON with fields to update in ATTRIBUTE_OPTION (e.g. {"OPTION_TEXT": "New Option Text"})
    WHERE_JSON VARIANT   -- JSON with a key "where" containing the WHERE clause (e.g. {"where": "ATTRIBUTE_OPTION_ID = 101"})
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // 1. Validate and extract the WHERE clause.
    var whereClause = (WHERE_JSON && WHERE_JSON.where) ? WHERE_JSON.where : null;
    if (!whereClause) {
         throw "WHERE clause is required for update.";
    }
    
    // 2. Build the dynamic UPDATE statement for ATTRIBUTE_OPTION.
    var data = DATA_JSON;
    var setClauses = [];
    for (var key in data) {
         var val = data[key];
         if (typeof val === "string") {
             // Escape single quotes.
             val = val.replace(/'/g, "''");
             setClauses.push(key + " = '" + val + "'");
         } else if (typeof val === "boolean") {
             setClauses.push(key + " = " + (val ? "TRUE" : "FALSE"));
         } else if (val === null) {
             setClauses.push(key + " = NULL");
         } else {
             setClauses.push(key + " = " + val.toString());
         }
    }
    var updateSQL = "UPDATE EVERSHOP_COPY.PUBLIC.ATTRIBUTE_OPTION SET " 
                    + setClauses.join(", ") 
                    + " WHERE " + whereClause;
    var stmtUpdate = snowflake.createStatement({ sqlText: updateSQL });
    stmtUpdate.execute();
    
    // 3. Retrieve the updated ATTRIBUTE_OPTION row.
    var selectSQL = "SELECT * FROM EVERSHOP_COPY.PUBLIC.ATTRIBUTE_OPTION WHERE " + whereClause + " LIMIT 1";
    var stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    var result = stmtSelect.execute();
    if (!result.next()) {
         throw "No attribute option found for update.";
    }
    var updatedRow = {};
    var colCount = result.getColumnCount();
    for (var i = 1; i <= colCount; i++) {
         var colName = result.getColumnName(i);
         updatedRow[colName] = result.getColumnValue(i);
    }
    
    // 4. Cascade update to PRODUCT_ATTRIBUTE_VALUE_INDEX:
    // Set OPTION_TEXT = updatedRow.OPTION_TEXT where
    // OPTION_ID = updatedRow.ATTRIBUTE_OPTION_ID and ATTRIBUTE_ID = updatedRow.ATTRIBUTE_ID.
    var newOptionText = updatedRow["OPTION_TEXT"];
    var attributeOptionId = updatedRow["ATTRIBUTE_OPTION_ID"];
    var attributeId = updatedRow["ATTRIBUTE_ID"];
    
    if (newOptionText !== undefined && attributeOptionId !== undefined && attributeId !== undefined) {
         // Escape single quotes in newOptionText.
         newOptionText = newOptionText.replace(/'/g, "''");
         var cascadeSQL = "UPDATE EVERSHOP_COPY.PUBLIC.PRODUCT_ATTRIBUTE_VALUE_INDEX SET OPTION_TEXT = '" 
                          + newOptionText + "' WHERE OPTION_ID = " + attributeOptionId 
                          + " AND ATTRIBUTE_ID = " + attributeId;
         var stmtCascade = snowflake.createStatement({ sqlText: cascadeSQL });
         stmtCascade.execute();
    }
    
    // 5. Return the updated ATTRIBUTE_OPTION row as a VARIANT (mimicking RETURN NEW)
    return JSON.parse(JSON.stringify(updatedRow));
    
} catch (err) {
    return "Error: " + err;
}
$$;


CALL EVERSHOP_COPY.PUBLIC.UPDATE_ATTRIBUTE_OPTION_WITH_CASCADE(
    PARSE_JSON('{"OPTION_TEXT": "New Option Text"}'),
    PARSE_JSON('{"where": "ATTRIBUTE_OPTION_ID = 101"}')
);


*******************************************************************************************

    CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.DELETE_ATTRIBUTE_OPTION_WITH_CASCADE(
    WHERE_JSON VARIANT  -- JSON with key "where", e.g. {"where": "ATTRIBUTE_OPTION_ID = 101"}
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // 1. Extract the WHERE clause.
    var whereClause = (WHERE_JSON && WHERE_JSON.where) ? WHERE_JSON.where : null;
    if (!whereClause) {
        throw "WHERE clause is required for deletion.";
    }
    
    // 2. Retrieve rows from ATTRIBUTE_OPTION that match the WHERE clause.
    var selectSQL = "SELECT * FROM EVERSHOP_COPY.PUBLIC.ATTRIBUTE_OPTION WHERE " + whereClause;
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
    
    if(rowsToDelete.length === 0) {
        throw "No rows found for deletion.";
    }
    
    // 3. For each row, delete from PRODUCT_ATTRIBUTE_VALUE_INDEX.
    for (var j = 0; j < rowsToDelete.length; j++) {
        var currentRow = rowsToDelete[j];
        var attribute_option_id = currentRow["ATTRIBUTE_OPTION_ID"];
        var attribute_id = currentRow["ATTRIBUTE_ID"];
        
        var deleteIndexSQL = "DELETE FROM EVERSHOP_COPY.PUBLIC.PRODUCT_ATTRIBUTE_VALUE_INDEX " +
                             "WHERE OPTION_ID = " + attribute_option_id +
                             " AND ATTRIBUTE_ID = " + attribute_id;
        var stmtDeleteIndex = snowflake.createStatement({ sqlText: deleteIndexSQL });
        stmtDeleteIndex.execute();
    }
    
    // 4. Delete the rows from ATTRIBUTE_OPTION.
    var deleteSQL = "DELETE FROM EVERSHOP_COPY.PUBLIC.ATTRIBUTE_OPTION WHERE " + whereClause;
    var stmtDelete = snowflake.createStatement({ sqlText: deleteSQL });
    stmtDelete.execute();
    
    // 5. Return details of the deleted rows as a JSON array.
    return JSON.parse(JSON.stringify(rowsToDelete));
    
} catch (err) {
    return "Error: " + err;
}
$$;

INSERT INTO EVERSHOP_COPY.PUBLIC.ATTRIBUTE_OPTION (ATTRIBUTE_ID, ATTRIBUTE_CODE, OPTION_TEXT)
VALUES (101, 'COLOR', 'Red');

INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT_ATTRIBUTE_VALUE_INDEX (PRODUCT_ID, ATTRIBUTE_ID, OPTION_ID, OPTION_TEXT)
VALUES (1001, 101, 1, 'Red');


CALL EVERSHOP_COPY.PUBLIC.DELETE_ATTRIBUTE_OPTION_WITH_CASCADE(
    PARSE_JSON('{ "where": "ATTRIBUTE_OPTION_ID = 1" }')
);----id based on ATTRIBUTE_OPTION_ID 


***************************************************************************

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.INSERT_PRODUCT_AND_UPDATE_VARIANT_GROUP(
    DATA_JSON VARIANT  -- JSON with key-value pairs for fields to insert into PRODUCT
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // --- 1. Build the dynamic INSERT statement for the PRODUCT table ---
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
    
    var insertSQL = "INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT (" 
                    + columns.join(", ") 
                    + ") VALUES (" 
                    + values.join(", ") 
                    + ")";
    var stmtInsert = snowflake.createStatement({ sqlText: insertSQL });
    stmtInsert.execute();
    
    // --- 2. Retrieve the newly inserted PRODUCT row ---
    // (Assumes no concurrent inserts; select the row with the highest PRODUCT_ID)
    var selectSQL = "SELECT * FROM EVERSHOP_COPY.PUBLIC.PRODUCT ORDER BY PRODUCT_ID DESC LIMIT 1";
    var stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    var result = stmtSelect.execute();
    if (!result.next()) {
        throw "No product inserted.";
    }
    var insertedRow = {};
    var colCount = result.getColumnCount();
    for (var i = 1; i <= colCount; i++) {
        var colName = result.getColumnName(i);
        insertedRow[colName] = result.getColumnValue(i);
    }
    
    // --- 3. Update the VARIANT_GROUP visibility if applicable ---
    // If the inserted product has a non-null VARIANT_GROUP_ID, update its visibility.
    var variantGroupId = insertedRow["VARIANT_GROUP_ID"];
    if (variantGroupId !== null) {
        // Simulate bool_or(visibility) by checking if any product in this group has STATUS = TRUE.
        // If MAX(CASE WHEN STATUS = TRUE THEN 1 ELSE 0 END) equals 1, then set visibility to TRUE; else FALSE.
        var updateVariantSQL = "UPDATE EVERSHOP_COPY.PUBLIC.VARIANT_GROUP " +
            "SET VISIBILITY = COALESCE((SELECT IFF(MAX(CASE WHEN STATUS = TRUE THEN 1 ELSE 0 END) = 1, TRUE, FALSE) " +
            "FROM EVERSHOP_COPY.PUBLIC.PRODUCT " +
            "WHERE VARIANT_GROUP_ID = " + variantGroupId + " " +
            "GROUP BY VARIANT_GROUP_ID), FALSE) " +
            "WHERE VARIANT_GROUP_ID = " + variantGroupId;
        var stmtVariant = snowflake.createStatement({ sqlText: updateVariantSQL });
        stmtVariant.execute();
    }
    
    // --- 4. Return the inserted product row as a VARIANT (mimicking RETURN NEW) ---
    return JSON.parse(JSON.stringify(insertedRow));
} catch (err) {
    return "Error: " + err;
}
$$;

CALL EVERSHOP_COPY.PUBLIC.INSERT_PRODUCT_AND_UPDATE_VARIANT_GROUP(
    PARSE_JSON('{
        "SKU": "SKU-XYZ-001",
        "PRICE": 99.99,
        "STATUS": TRUE,
        "GROUP_ID": 2,
        "VARIANT_GROUP_ID": 5,
        "TYPE": "simple"
    }')
);


*********************************************************************************************

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.UPDATE_PRODUCT_WITH_CASCADE(
    DATA_JSON VARIANT,   -- JSON with fields to update (e.g., {"GROUP_ID": 3, "STATUS": TRUE, ...})
    WHERE_JSON VARIANT   -- JSON with key "where" (e.g., {"where": "PRODUCT_ID = 101"})
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // 1. Validate and extract the WHERE clause.
    var whereClause = (WHERE_JSON && WHERE_JSON.where) ? WHERE_JSON.where : null;
    if (!whereClause) {
        throw "WHERE clause is required for update.";
    }
    
    // 2. Build and execute the UPDATE statement on the PRODUCT table.
    var data = DATA_JSON;
    var setClauses = [];
    for (var key in data) {
        var val = data[key];
        if (typeof val === "string") {
            val = val.replace(/'/g, "''");
            setClauses.push(key + " = '" + val + "'");
        } else if (typeof val === "boolean") {
            setClauses.push(key + " = " + (val ? "TRUE" : "FALSE"));
        } else if (val === null) {
            setClauses.push(key + " = NULL");
        } else {
            setClauses.push(key + " = " + val.toString());
        }
    }
    var updateSQL = "UPDATE EVERSHOP_COPY.PUBLIC.PRODUCT SET " 
                    + setClauses.join(", ") 
                    + " WHERE " + whereClause;
    var stmtUpdate = snowflake.createStatement({ sqlText: updateSQL });
    stmtUpdate.execute();
    
    // 3. Retrieve the updated product row.
    var selectSQL = "SELECT * FROM EVERSHOP_COPY.PUBLIC.PRODUCT WHERE " + whereClause + " LIMIT 1";
    var stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    var resultSelect = stmtSelect.execute();
    if (!resultSelect.next()) {
         throw "No product found for update.";
    }
    var updatedProduct = {};
    var colCount = resultSelect.getColumnCount();
    for (var i = 1; i <= colCount; i++) {
         var colName = resultSelect.getColumnName(i);
         updatedProduct[colName] = resultSelect.getColumnValue(i);
    }
    
    // 4. Cascade delete from PRODUCT_ATTRIBUTE_VALUE_INDEX.
    // Delete all rows where:
    //   - PRODUCT_ID matches updatedProduct.PRODUCT_ID, AND
    //   - ATTRIBUTE_ID is NOT in (SELECT ATTRIBUTE_ID FROM ATTRIBUTE_GROUP_LINK WHERE GROUP_ID = updatedProduct.GROUP_ID)
    var prodId = updatedProduct["PRODUCT_ID"];
    var groupId = updatedProduct["GROUP_ID"];
    var deleteIndexSQL = "DELETE FROM EVERSHOP_COPY.PUBLIC.PRODUCT_ATTRIBUTE_VALUE_INDEX " +
                         "WHERE PRODUCT_ID = " + prodId + " " +
                         "AND ATTRIBUTE_ID NOT IN (SELECT ATTRIBUTE_ID FROM EVERSHOP_COPY.PUBLIC.ATTRIBUTE_GROUP_LINK WHERE GROUP_ID = " + groupId + ")";
    var stmtDeleteIndex = snowflake.createStatement({ sqlText: deleteIndexSQL });
    stmtDeleteIndex.execute();
    
    // 5. Update the VARIANT_GROUP visibility.
    // Calculate the visibility based on whether any product in the same variant group has STATUS = TRUE.
    var variantGroupId = updatedProduct["VARIANT_GROUP_ID"];
    if (variantGroupId !== null) {
         var updateVariantSQL = "UPDATE EVERSHOP_COPY.PUBLIC.VARIANT_GROUP " +
                                "SET VISIBILITY = COALESCE((SELECT IFF(MAX(CASE WHEN STATUS = TRUE THEN 1 ELSE 0 END) = 1, TRUE, FALSE) " +
                                "FROM EVERSHOP_COPY.PUBLIC.PRODUCT " +
                                "WHERE VARIANT_GROUP_ID = " + variantGroupId + " " +
                                "GROUP BY VARIANT_GROUP_ID), FALSE) " +
                                "WHERE VARIANT_GROUP_ID = " + variantGroupId;
         var stmtVariant = snowflake.createStatement({ sqlText: updateVariantSQL });
         stmtVariant.execute();
    }
    
    // 6. Return the updated product row as a VARIANT.
    return JSON.parse(JSON.stringify(updatedProduct));
    
} catch (err) {
    return "Error: " + err;
}
$$;


CALL EVERSHOP_COPY.PUBLIC.UPDATE_PRODUCT_WITH_CASCADE(
    PARSE_JSON('{"STATUS": true, "PRICE": 150.00}'),
    PARSE_JSON('{"where": "PRODUCT_ID = 101"}')
);


What Happens:

The procedure updates the product row with PRODUCT_ID = 101 in the PRODUCT table using the provided JSON (setting STATUS to TRUE and PRICE to 150.00).
It then retrieves the updated product row.
Next, it deletes from PRODUCT_ATTRIBUTE_VALUE_INDEX any rows for that product where the ATTRIBUTE_ID is not in the allowed list (based on the product’s GROUP_ID).
Then, if the product has a non-null VARIANT_GROUP_ID, it updates the corresponding VARIANT_GROUP row’s VISIBILITY. The visibility is set to TRUE if any product in that variant group has STATUS = TRUE.
Finally, the procedure returns the updated product row as a JSON (VARIANT).

    
************************************************************************************************

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.UPDATE_ATTRIBUTE_WITH_CASCADE(
    DATA_JSON VARIANT,   -- JSON with fields to update, e.g. {"TYPE": "text", "ATTRIBUTE_NAME": "Color"}
    WHERE_JSON VARIANT   -- JSON with key "where", e.g. {"where": "ATTRIBUTE_ID = 201"}
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // 1. Extract the WHERE clause.
    var whereClause = (WHERE_JSON && WHERE_JSON.where) ? WHERE_JSON.where : null;
    if (!whereClause) {
         throw "WHERE clause is required for update.";
    }
    
    // 2. Retrieve the old attribute row.
    var selectOldSQL = "SELECT * FROM EVERSHOP_COPY.PUBLIC.ATTRIBUTE WHERE " + whereClause;
    var stmtOld = snowflake.createStatement({ sqlText: selectOldSQL });
    var resultOld = stmtOld.execute();
    if (!resultOld.next()) { 
         throw "No attribute found for update."; 
    }
    var oldRow = {};
    var colCount = resultOld.getColumnCount();
    for (var i = 1; i <= colCount; i++) {
         var colName = resultOld.getColumnName(i);
         oldRow[colName] = resultOld.getColumnValue(i);
    }
    
    // 3. Build newRow by merging oldRow with DATA_JSON.
    var data = DATA_JSON;
    var newRow = {};
    // Start with old values.
    for (var key in oldRow) {
         newRow[key] = oldRow[key];
    }
    // Overwrite with new values.
    for (var key in data) {
         newRow[key] = data[key];
    }
    
    // 4. Check if type changed from 'select' to something else.
    //    If so, cascade deletion from VARIANT_GROUP.
    if (oldRow["TYPE"] === 'select' && newRow["TYPE"] !== 'select') {
         var attributeId = oldRow["ATTRIBUTE_ID"];
         var deleteVariantSQL = "DELETE FROM EVERSHOP_COPY.PUBLIC.VARIANT_GROUP " +
                                "WHERE ATTRIBUTE_GROUP_ID = (SELECT GROUP_ID FROM EVERSHOP_COPY.PUBLIC.ATTRIBUTE WHERE ATTRIBUTE_ID = " + attributeId + ") " +
                                "AND (ATTRIBUTE_ONE = " + attributeId +
                                " OR ATTRIBUTE_TWO = " + attributeId +
                                " OR ATTRIBUTE_THREE = " + attributeId +
                                " OR ATTRIBUTE_FOUR = " + attributeId +
                                " OR ATTRIBUTE_FIVE = " + attributeId + ")";
         // Alternatively, if ATTRIBUTE_GROUP_ID in VARIANT_GROUP is meant to equal some other value,
         // you might simply match on the attribute columns.
         // For simplicity, we use the condition below without the subquery:
         deleteVariantSQL = "DELETE FROM EVERSHOP_COPY.PUBLIC.VARIANT_GROUP " +
                            "WHERE (ATTRIBUTE_ONE = " + attributeId +
                            " OR ATTRIBUTE_TWO = " + attributeId +
                            " OR ATTRIBUTE_THREE = " + attributeId +
                            " OR ATTRIBUTE_FOUR = " + attributeId +
                            " OR ATTRIBUTE_FIVE = " + attributeId + ")";
         var stmtDeleteVariant = snowflake.createStatement({ sqlText: deleteVariantSQL });
         stmtDeleteVariant.execute();
    }
    
    // 5. Build the dynamic UPDATE statement for the ATTRIBUTE table using fields from DATA_JSON.
    var setClauses = [];
    for (var key in data) {
         var val = data[key];
         if (typeof val === "string") {
             val = val.replace(/'/g, "''");
             setClauses.push(key + " = '" + val + "'");
         } else if (typeof val === "boolean") {
             setClauses.push(key + " = " + (val ? "TRUE" : "FALSE"));
         } else if (val === null) {
             setClauses.push(key + " = NULL");
         } else {
             setClauses.push(key + " = " + val.toString());
         }
    }
    var updateSQL = "UPDATE EVERSHOP_COPY.PUBLIC.ATTRIBUTE SET " 
                    + setClauses.join(", ") 
                    + " WHERE " + whereClause;
    var stmtUpdate = snowflake.createStatement({ sqlText: updateSQL });
    stmtUpdate.execute();
    
    // 6. Retrieve the updated attribute row.
    var selectNewSQL = "SELECT * FROM EVERSHOP_COPY.PUBLIC.ATTRIBUTE WHERE " + whereClause + " LIMIT 1";
    var stmtNew = snowflake.createStatement({ sqlText: selectNewSQL });
    var resultNew = stmtNew.execute();
    if (!resultNew.next()) {
         throw "Unable to retrieve updated attribute.";
    }
    var updatedRow = {};
    var colCountNew = resultNew.getColumnCount();
    for (var i = 1; i <= colCountNew; i++) {
         var colNameNew = resultNew.getColumnName(i);
         updatedRow[colNameNew] = resultNew.getColumnValue(i);
    }
    
    // 7. Return the updated row as a VARIANT.
    return JSON.parse(JSON.stringify(updatedRow));
    
} catch (err) {
    return "Error: " + err;
}
$$;



CALL EVERSHOP_COPY.PUBLIC.UPDATE_ATTRIBUTE_WITH_CASCADE(
    PARSE_JSON('{"TYPE": "text", "ATTRIBUTE_NAME": "Color"}'),
    PARSE_JSON('{"where": "ATTRIBUTE_ID = 201"}')
);

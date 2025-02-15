FILENAME=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.0.js

LINE=502-686


C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\api\deleteAttributeGroup\deleteAttributeGroup.js
43

CREATE OR REPLACE PROCEDURE prevent_delete_default_attribute_group(
    whereClause STRING  -- Only the WHERE clause is passed, e.g. "ATTRIBUTE_GROUP_ID = 5"
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // Begin transaction.
    snowflake.execute({ sqlText: `BEGIN TRANSACTION` });
    
    // Validate that the whereClause is provided.
    if (!whereClause || whereClause.trim() === "") {
        throw new Error("WHERE clause is required for deletion.");
    }
    
    // --- 1. Retrieve rows to be deleted using OBJECT_CONSTRUCT_KEEP_NULL(*) ---
    const selectSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data 
        FROM ATTRIBUTE_GROUP 
        WHERE ${whereClause}
    `;
    const stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    const result = stmtSelect.execute();
    
    let rowsToDelete = [];
    while(result.next()){
        const row = result.getColumnValue("row_data");
        // Check if this is the default attribute group.
        if(row["ATTRIBUTE_GROUP_ID"] == 1) {
            throw new Error("Cannot delete default attribute group");
        }
        rowsToDelete.push(row);
    }
    
    if(rowsToDelete.length === 0) {
        throw new Error("No attribute group found for the given WHERE clause.");
    }
    
    // --- 2. Delete the rows ---
    const deleteSQL = `
        DELETE FROM ATTRIBUTE_GROUP 
        WHERE ${whereClause}
    `;
    const stmtDelete = snowflake.createStatement({ sqlText: deleteSQL });
    stmtDelete.execute();
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // --- 3. Return the details of the deleted rows as a JSON array ---
    return rowsToDelete;
    
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error(`Procedure DELETE_ATTRIBUTE_GROUP_AND_LOG failed: ${err.message || err}`);
}
$$;


CALL prevent_delete_default_attribute_group(
    PARSE_JSON('{ "where": "ATTRIBUTE_GROUP_ID = 1" }')
);  ---there as to be the row with ATTRIBUTE_GROUP_ID = 1 in the table 


*************************************************************************************************************

C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\components\admin\promotion\couponEdit\BuyXGetY.jsx
146
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\api\unlinkVariant\unlinkVariants.js
14
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.2.js
20
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\product\updateProduct.js
279
311

CREATE OR REPLACE PROCEDURE prevent_change_attribute_group(
    DATA_JSON VARIANT,     -- JSON with fields to update, e.g. {"GROUP_ID": 5}
    whereClause STRING     -- WHERE clause for PRODUCT update, e.g. "PRODUCT_ID = 101"
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // Begin transaction.
    snowflake.execute({ sqlText: `BEGIN TRANSACTION` });
    
    // 1. Validate the WHERE clause.
    if (!whereClause || whereClause.trim() === "") {
        throw new Error("WHERE clause is required for update.");
    }
    
    // 2. Retrieve the existing (OLD) product row using OBJECT_CONSTRUCT_KEEP_NULL(*)
    const selectOldSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data 
        FROM PRODUCT 
        WHERE ${whereClause}
    `;
    const stmtOld = snowflake.createStatement({ sqlText: selectOldSQL });
    const resultOld = stmtOld.execute();
    if (!resultOld.next()) {
         throw new Error("No product found for update.");
    }
    const oldRow = resultOld.getColumnValue("row_data");
    
    // 3. Merge the old row with the update values from DATA_JSON.
    //    For any field in DATA_JSON, use the new value; otherwise, retain the old value.
    const data = DATA_JSON;
    const newRow = Object.assign({}, oldRow, data);
    
    // 4. Check if the attribute group is being changed when variants exist.
    //    If old GROUP_ID != new GROUP_ID and old VARIANT_GROUP_ID is not null, raise an error.
    if (oldRow["GROUP_ID"] != newRow["GROUP_ID"] && oldRow["VARIANT_GROUP_ID"] !== null) {
         throw new Error("Cannot change attribute group of product with variants");
    }
    
    // 5. Build the dynamic UPDATE statement using fields from DATA_JSON.
    let setClauses = [];
    for (let key in data) {
         let val = data[key];
         if (typeof val === "string") {
             // Escape single quotes.
             val = val.replace(/'/g, "''");
             setClauses.push(`${key} = '${val}'`);
         } else if (typeof val === "boolean") {
             setClauses.push(`${key} = ${val ? "TRUE" : "FALSE"}`);
         } else if (val === null) {
             setClauses.push(`${key} = NULL`);
         } else {
             setClauses.push(`${key} = ${val}`);
         }
    }
    const updateSQL = `
        UPDATE PRODUCT 
        SET ${setClauses.join(", ")} 
        WHERE ${whereClause}
    `;
    const stmtUpdate = snowflake.createStatement({ sqlText: updateSQL });
    stmtUpdate.execute();
    
    // 6. Retrieve the updated product row using OBJECT_CONSTRUCT_KEEP_NULL(*)
    const selectNewSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data 
        FROM PRODUCT 
        WHERE ${whereClause}
    `;
    const stmtNew = snowflake.createStatement({ sqlText: selectNewSQL });
    const resultNew = stmtNew.execute();
    if (!resultNew.next()) {
         throw new Error("Unable to retrieve updated product.");
    }
    const updatedRow = resultNew.getColumnValue("row_data");
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // 7. Return the updated product row as a VARIANT.
    return updatedRow;
    
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error(`Procedure UPDATE_PRODUCT_WITH_ATTRIBUTE_GROUP_CHECK failed: ${err.message || err}`);
}
$$;

CALL UPDATE_PRODUCT_WITH_ATTRIBUTE_GROUP_CHECK(
    PARSE_JSON('{"GROUP_ID": 5, "PRICE": 199.99}'),
    'PRODUCT_ID = 101'
);


****************************************************************************
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\attribute\updateProductAttribute.js
134

CREATE OR REPLACE PROCEDURE remove_attribute_from_group(
    whereClause STRING  -- The WHERE clause, e.g. "ATTRIBUTE_GROUP_LINK_ID = 1"
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // Begin transaction.
    snowflake.execute({ sqlText: `BEGIN TRANSACTION` });
    
    // Validate the WHERE clause.
    if (!whereClause || whereClause.trim() === "") {
        throw new Error("WHERE clause is required for deletion.");
    }
    
    // 1. Retrieve rows to be deleted from ATTRIBUTE_GROUP_LINK using OBJECT_CONSTRUCT_KEEP_NULL(*)
    const selectSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM ATTRIBUTE_GROUP_LINK
        WHERE ${whereClause}
    `;
    const stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    const result = stmtSelect.execute();
    
    let rowsToDelete = [];
    while (result.next()) {
        const row = result.getColumnValue("row_data");
        rowsToDelete.push(row);
    }
    
    if (rowsToDelete.length === 0) {
        throw new Error("No rows found for deletion.");
    }
    
    // 3. For each row, perform cascading deletions.
    for (let j = 0; j < rowsToDelete.length; j++) {
        const currentRow = rowsToDelete[j];
        const attribute_id = currentRow["ATTRIBUTE_ID"];
        const group_id = currentRow["GROUP_ID"];
        
        // Delete from PRODUCT_ATTRIBUTE_VALUE_INDEX where:
        // - ATTRIBUTE_ID equals the deleted attribute, and
        // - PRODUCT_ID is in the set of products with GROUP_ID equal to the deleted row's group.
        const deleteIndexSQL = `
            DELETE FROM PRODUCT_ATTRIBUTE_VALUE_INDEX
            WHERE ATTRIBUTE_ID = ${attribute_id}
              AND PRODUCT_ID IN (SELECT PRODUCT_ID FROM PRODUCT WHERE GROUP_ID = ${group_id})
        `;
        const stmtDeleteIndex = snowflake.createStatement({ sqlText: deleteIndexSQL });
        stmtDeleteIndex.execute();
        
        // Delete from VARIANT_GROUP where:
        // - ATTRIBUTE_GROUP_ID equals the deleted row's group, and
        // - Any of ATTRIBUTE_ONE, ATTRIBUTE_TWO, ATTRIBUTE_THREE, ATTRIBUTE_FOUR, or ATTRIBUTE_FIVE equals the deleted attribute.
        const deleteVariantSQL = `
            DELETE FROM VARIANT_GROUP
            WHERE ATTRIBUTE_GROUP_ID = ${group_id}
              AND (ATTRIBUTE_ONE = ${attribute_id}
                OR ATTRIBUTE_TWO = ${attribute_id}
                OR ATTRIBUTE_THREE = ${attribute_id}
                OR ATTRIBUTE_FOUR = ${attribute_id}
                OR ATTRIBUTE_FIVE = ${attribute_id})
        `;
        const stmtDeleteVariant = snowflake.createStatement({ sqlText: deleteVariantSQL });
        stmtDeleteVariant.execute();
    }
    
    // 4. Delete the rows from ATTRIBUTE_GROUP_LINK.
    const deleteSQL = `
        DELETE FROM ATTRIBUTE_GROUP_LINK
        WHERE ${whereClause}
    `;
    const stmtDelete = snowflake.createStatement({ sqlText: deleteSQL });
    stmtDelete.execute();
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // 5. Return details of the deleted rows as a JSON array.
    return rowsToDelete;
    
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error(`Procedure DELETE_ATTRIBUTE_GROUP_LINK_CASCADE failed: ${err.message || err}`);
}
$$;

CALL DELETE_ATTRIBUTE_GROUP_LINK_CASCADE('ATTRIBUTE_GROUP_LINK_ID = 1');



*************************************************************************
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\attribute\updateProductAttribute.js
80
    
CREATE OR REPLACE PROCEDURE update_product_attribute_option_value_text(
    DATA_JSON VARIANT,     -- JSON with fields to update in ATTRIBUTE_OPTION (e.g. {"OPTION_TEXT": "New Option Text"})
    whereClause STRING     -- WHERE clause for update, e.g. "ATTRIBUTE_OPTION_ID = 101"
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // Begin transaction.
    snowflake.execute({ sqlText: `BEGIN TRANSACTION` });
    
    // 1. Validate the WHERE clause.
    if (!whereClause || whereClause.trim() === "") {
        throw new Error("WHERE clause is required for update.");
    }
    
    // 2. Build the dynamic UPDATE statement for ATTRIBUTE_OPTION.
    const data = DATA_JSON;
    let setClauses = [];
    for (let key in data) {
         let val = data[key];
         if (typeof val === "string") {
             val = val.replace(/'/g, "''");
             setClauses.push(`${key} = '${val}'`);
         } else if (typeof val === "boolean") {
             setClauses.push(`${key} = ${val ? "TRUE" : "FALSE"}`);
         } else if (val === null) {
             setClauses.push(`${key} = NULL`);
         } else {
             setClauses.push(`${key} = ${val}`);
         }
    }
    const updateSQL = `
        UPDATE ATTRIBUTE_OPTION
        SET ${setClauses.join(", ")}
        WHERE ${whereClause}
    `;
    const stmtUpdate = snowflake.createStatement({ sqlText: updateSQL });
    stmtUpdate.execute();
    
    // 3. Retrieve the updated ATTRIBUTE_OPTION row using OBJECT_CONSTRUCT_KEEP_NULL(*)
    const selectSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM ATTRIBUTE_OPTION
        WHERE ${whereClause}
        LIMIT 1
    `;
    const stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    const result = stmtSelect.execute();
    if (!result.next()) {
         throw new Error("No attribute option found for update.");
    }
    const updatedRow = result.getColumnValue("row_data");
    
    // 4. Cascade update to PRODUCT_ATTRIBUTE_VALUE_INDEX:
    //    Set OPTION_TEXT = updatedRow.OPTION_TEXT where
    //    OPTION_ID = updatedRow.ATTRIBUTE_OPTION_ID and ATTRIBUTE_ID = updatedRow.ATTRIBUTE_ID.
    let newOptionText = updatedRow["OPTION_TEXT"];
    const attributeOptionId = updatedRow["ATTRIBUTE_OPTION_ID"];
    const attributeId = updatedRow["ATTRIBUTE_ID"];
    
    if (newOptionText !== undefined && attributeOptionId !== undefined && attributeId !== undefined) {
         newOptionText = newOptionText.replace(/'/g, "''");
         const cascadeSQL = `
            UPDATE PRODUCT_ATTRIBUTE_VALUE_INDEX
            SET OPTION_TEXT = '${newOptionText}'
            WHERE OPTION_ID = ${attributeOptionId}
              AND ATTRIBUTE_ID = ${attributeId}
         `;
         const stmtCascade = snowflake.createStatement({ sqlText: cascadeSQL });
         stmtCascade.execute();
    }
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // 5. Return the updated ATTRIBUTE_OPTION row as a VARIANT.
    return updatedRow;
    
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error(`Procedure UPDATE_ATTRIBUTE_OPTION_WITH_CASCADE failed: ${err.message || err}`);
}
$$;


CALL update_product_attribute_option_value_text(
    PARSE_JSON('{"OPTION_TEXT": "New Option Text"}'),
    'ATTRIBUTE_OPTION_ID = 101'
);



*******************************************************************************************
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\attribute\updateProductAttribute.js
64

 CREATE OR REPLACE PROCEDURE delete_product_attribute_value_index(
    whereClause STRING  -- WHERE clause, e.g. "ATTRIBUTE_OPTION_ID = 101"
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // Begin transaction.
    snowflake.execute({ sqlText: `BEGIN TRANSACTION` });
    
    // Validate the WHERE clause.
    if (!whereClause || whereClause.trim() === "") {
        throw new Error("WHERE clause is required for deletion.");
    }
    
    // 2. Retrieve rows from ATTRIBUTE_OPTION that match the WHERE clause using OBJECT_CONSTRUCT_KEEP_NULL(*)
    const selectSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM ATTRIBUTE_OPTION
        WHERE ${whereClause}
    `;
    const stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    const result = stmtSelect.execute();
    
    let rowsToDelete = [];
    while (result.next()) {
        const row = result.getColumnValue("row_data");
        rowsToDelete.push(row);
    }
    
    if (rowsToDelete.length === 0) {
        throw new Error("No rows found for deletion.");
    }
    
    // 3. For each row, delete from PRODUCT_ATTRIBUTE_VALUE_INDEX.
    for (let j = 0; j < rowsToDelete.length; j++) {
        const currentRow = rowsToDelete[j];
        const attribute_option_id = currentRow["ATTRIBUTE_OPTION_ID"];
        const attribute_id = currentRow["ATTRIBUTE_ID"];
        
        const deleteIndexSQL = `
            DELETE FROM PRODUCT_ATTRIBUTE_VALUE_INDEX
            WHERE OPTION_ID = ${attribute_option_id}
              AND ATTRIBUTE_ID = ${attribute_id}
        `;
        const stmtDeleteIndex = snowflake.createStatement({ sqlText: deleteIndexSQL });
        stmtDeleteIndex.execute();
    }
    
    // 4. Delete the rows from ATTRIBUTE_OPTION.
    const deleteSQL = `
        DELETE FROM ATTRIBUTE_OPTION
        WHERE ${whereClause}
    `;
    const stmtDelete = snowflake.createStatement({ sqlText: deleteSQL });
    stmtDelete.execute();
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // 5. Return details of the deleted rows as a JSON array.
    return rowsToDelete;
    
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error(`Procedure DELETE_ATTRIBUTE_OPTION_WITH_CASCADE failed: ${err.message || err}`);
}
$$;

CALL delete_product_attribute_value_index('ATTRIBUTE_OPTION_ID = 101');



***************************************************************************
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.4.js
46
81
116
151
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\product\createProduct.js
164


CREATE OR REPLACE PROCEDURE update_variant_group_visibility(
    DATA_JSON VARIANT  -- JSON with key-value pairs for fields to insert into PRODUCT
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // Begin transaction.
    snowflake.execute({ sqlText: `BEGIN TRANSACTION` });
    
    // --- 1. Build the dynamic INSERT statement for the PRODUCT table ---
    const data = DATA_JSON;
    let columns = [];
    let values = [];
    
    for (let key in data) {
        columns.push(key);
        let val = data[key];
        if (typeof val === 'string') {
            // Escape single quotes.
            val = val.replace(/'/g, "''");
            values.push(`'${val}'`);
        } else if (typeof val === 'boolean') {
            values.push(val ? "TRUE" : "FALSE");
        } else if (val === null) {
            values.push("NULL");
        } else {
            values.push(val.toString());
        }
    }
    
    const insertSQL = `
        INSERT INTO PRODUCT (${columns.join(", ")})
        VALUES (${values.join(", ")})
    `;
    const stmtInsert = snowflake.createStatement({ sqlText: insertSQL });
    stmtInsert.execute();
    
    // --- 2. Retrieve the newly inserted PRODUCT row using OBJECT_CONSTRUCT_KEEP_NULL(*) ---
    // (Assumes no concurrent inserts; selects the row with the highest PRODUCT_ID)
    const selectSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM PRODUCT
        ORDER BY PRODUCT_ID DESC
        LIMIT 1
    `;
    const stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    const result = stmtSelect.execute();
    if (!result.next()) {
        throw new Error("No product inserted.");
    }
    const insertedRow = result.getColumnValue("row_data");
    
    // --- 3. Update the VARIANT_GROUP visibility if applicable ---
    const variantGroupId = insertedRow["VARIANT_GROUP_ID"];
    if (variantGroupId !== null) {
        // Simulate bool_or(visibility) by checking if any product in this group has STATUS = TRUE.
        // If MAX(CASE WHEN STATUS = TRUE THEN 1 ELSE 0 END) equals 1, set visibility to TRUE; otherwise FALSE.
        const updateVariantSQL = `
            UPDATE VARIANT_GROUP
            SET VISIBILITY = COALESCE(
                (
                    SELECT IFF(MAX(CASE WHEN STATUS = TRUE THEN 1 ELSE 0 END) = 1, TRUE, FALSE)
                    FROM PRODUCT
                    WHERE VARIANT_GROUP_ID = ${variantGroupId}
                    GROUP BY VARIANT_GROUP_ID
                ), FALSE
            )
            WHERE VARIANT_GROUP_ID = ${variantGroupId}
        `;
        const stmtVariant = snowflake.createStatement({ sqlText: updateVariantSQL });
        stmtVariant.execute();
    }
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // --- 4. Return the inserted product row as a VARIANT (mimicking RETURN NEW) ---
    return insertedRow;
    
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error(`Procedure INSERT_PRODUCT_AND_UPDATE_VARIANT_GROUP failed: ${err.message || err}`);
}
$$;


CALL update_variant_group_visibility(
    PARSE_JSON('{"TYPE": "simple", "VARIANT_GROUP_ID": 5, "VISIBILITY": TRUE, "GROUP_ID": 10, "SKU": "SKU-101", "PRICE": 100.00, "STATUS": FALSE}')
);



*********************************************************************************************
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\components\admin\promotion\couponEdit\BuyXGetY.jsx
146
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\api\unlinkVariant\unlinkVariants.js
14
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.2.js
20
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\product\updateProduct.js
279
311

CREATE OR REPLACE PROCEDURE update_attribute_index_and_variant_group_visibility(
    DATA_JSON VARIANT,   -- JSON with fields to update (e.g., {"GROUP_ID": 3, "STATUS": TRUE, ...})
    whereClause STRING   -- WHERE clause (e.g., "PRODUCT_ID = 101")
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // Begin transaction.
    snowflake.execute({ sqlText: `BEGIN TRANSACTION` });
    
    // 1. Validate the WHERE clause.
    if (!whereClause || whereClause.trim() === "") {
        throw new Error("WHERE clause is required for update.");
    }
    
    // 2. Build and execute the UPDATE statement on the PRODUCT table.
    const data = DATA_JSON;
    let setClauses = [];
    for (let key in data) {
        let val = data[key];
        if (typeof val === "string") {
            val = val.replace(/'/g, "''");
            setClauses.push(`${key} = '${val}'`);
        } else if (typeof val === "boolean") {
            setClauses.push(`${key} = ${val ? "TRUE" : "FALSE"}`);
        } else if (val === null) {
            setClauses.push(`${key} = NULL`);
        } else {
            setClauses.push(`${key} = ${val}`);
        }
    }
    
    const updateSQL = `
        UPDATE PRODUCT
        SET ${setClauses.join(", ")}
        WHERE ${whereClause}
    `;
    const stmtUpdate = snowflake.createStatement({ sqlText: updateSQL });
    stmtUpdate.execute();
    
    // 3. Retrieve the updated product row using OBJECT_CONSTRUCT_KEEP_NULL(*)
    const selectSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM PRODUCT
        WHERE ${whereClause}
        LIMIT 1
    `;
    const stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    const resultSelect = stmtSelect.execute();
    if (!resultSelect.next()) {
         throw new Error("No product found for update.");
    }
    const updatedProduct = resultSelect.getColumnValue("row_data");
    
    // 4. Cascade delete from PRODUCT_ATTRIBUTE_VALUE_INDEX.
    // Delete rows where:
    //   - PRODUCT_ID matches updatedProduct.PRODUCT_ID, AND
    //   - ATTRIBUTE_ID is NOT in (SELECT ATTRIBUTE_ID FROM ATTRIBUTE_GROUP_LINK WHERE GROUP_ID = updatedProduct.GROUP_ID)
    const prodId = updatedProduct["PRODUCT_ID"];
    const groupId = updatedProduct["GROUP_ID"];
    const deleteIndexSQL = `
        DELETE FROM PRODUCT_ATTRIBUTE_VALUE_INDEX
        WHERE PRODUCT_ID = ${prodId}
          AND ATTRIBUTE_ID NOT IN (
              SELECT ATTRIBUTE_ID
              FROM ATTRIBUTE_GROUP_LINK
              WHERE GROUP_ID = ${groupId}
          )
    `;
    const stmtDeleteIndex = snowflake.createStatement({ sqlText: deleteIndexSQL });
    stmtDeleteIndex.execute();
    
    // 5. Update the VARIANT_GROUP visibility.
    // Determine visibility based on whether any product in the same variant group has STATUS = TRUE.
    const variantGroupId = updatedProduct["VARIANT_GROUP_ID"];
    if (variantGroupId !== null) {
         const updateVariantSQL = `
             UPDATE VARIANT_GROUP
             SET VISIBILITY = COALESCE(
                 (
                     SELECT IFF(MAX(CASE WHEN STATUS = TRUE THEN 1 ELSE 0 END) = 1, TRUE, FALSE)
                     FROM PRODUCT
                     WHERE VARIANT_GROUP_ID = ${variantGroupId}
                     GROUP BY VARIANT_GROUP_ID
                 ), FALSE
             )
             WHERE VARIANT_GROUP_ID = ${variantGroupId}
         `;
         const stmtVariant = snowflake.createStatement({ sqlText: updateVariantSQL });
         stmtVariant.execute();
    }
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // 6. Return the updated product row as a VARIANT.
    return updatedProduct;
    
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error(`Procedure UPDATE_PRODUCT_WITH_CASCADE failed: ${err.message || err}`);
}
$$;



CALL update_attribute_index_and_variant_group_visibility(
    PARSE_JSON('{"GROUP_ID": 3, "STATUS": TRUE, "PRICE": 150.00}'),
    'PRODUCT_ID = 101'
);


    
************************************************************************************************

C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\attribute\updateProductAttribute.js
150

CREATE OR REPLACE PROCEDURE delete_variant_group_after_attribute_type_changed(
    DATA_JSON VARIANT,   -- JSON with fields to update, e.g. {"TYPE": "text", "ATTRIBUTE_NAME": "Color"}
    whereClause STRING   -- WHERE clause, e.g. "ATTRIBUTE_ID = 201"
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // Begin transaction.
    snowflake.execute({ sqlText: `BEGIN TRANSACTION` });
    
    // 1. Validate the WHERE clause.
    if (!whereClause || whereClause.trim() === "") {
         throw new Error("WHERE clause is required for update.");
    }
    
    // 2. Retrieve the old attribute row using OBJECT_CONSTRUCT_KEEP_NULL(*)
    const selectOldSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM ATTRIBUTE
        WHERE ${whereClause}
        LIMIT 1
    `;
    const stmtOld = snowflake.createStatement({ sqlText: selectOldSQL });
    const resultOld = stmtOld.execute();
    if (!resultOld.next()) { 
         throw new Error("No attribute found for update."); 
    }
    const oldRow = resultOld.getColumnValue("row_data");
    
    // 3. Build newRow by merging oldRow with DATA_JSON.
    const data = DATA_JSON;
    const newRow = Object.assign({}, oldRow, data);
    
    // 4. Check if type changed from 'select' to something else.
    //    If so, cascade deletion from VARIANT_GROUP.
    if (oldRow["TYPE"] === 'select' && newRow["TYPE"] !== 'select') {
         const attributeId = oldRow["ATTRIBUTE_ID"];
         // For simplicity, we match on the attribute columns.
         const deleteVariantSQL = `
             DELETE FROM VARIANT_GROUP
             WHERE (ATTRIBUTE_ONE = ${attributeId}
                   OR ATTRIBUTE_TWO = ${attributeId}
                   OR ATTRIBUTE_THREE = ${attributeId}
                   OR ATTRIBUTE_FOUR = ${attributeId}
                   OR ATTRIBUTE_FIVE = ${attributeId})
         `;
         const stmtDeleteVariant = snowflake.createStatement({ sqlText: deleteVariantSQL });
         stmtDeleteVariant.execute();
    }
    
    // 5. Build the dynamic UPDATE statement for the ATTRIBUTE table using fields from DATA_JSON.
    let setClauses = [];
    for (let key in data) {
         let val = data[key];
         if (typeof val === "string") {
             val = val.replace(/'/g, "''");
             setClauses.push(`${key} = '${val}'`);
         } else if (typeof val === "boolean") {
             setClauses.push(`${key} = ${val ? "TRUE" : "FALSE"}`);
         } else if (val === null) {
             setClauses.push(`${key} = NULL`);
         } else {
             setClauses.push(`${key} = ${val}`);
         }
    }
    const updateSQL = `
        UPDATE ATTRIBUTE
        SET ${setClauses.join(", ")}
        WHERE ${whereClause}
    `;
    const stmtUpdate = snowflake.createStatement({ sqlText: updateSQL });
    stmtUpdate.execute();
    
    // 6. Retrieve the updated attribute row using OBJECT_CONSTRUCT_KEEP_NULL(*)
    const selectNewSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM ATTRIBUTE
        WHERE ${whereClause}
        LIMIT 1
    `;
    const stmtNew = snowflake.createStatement({ sqlText: selectNewSQL });
    const resultNew = stmtNew.execute();
    if (!resultNew.next()) {
         throw new Error("Unable to retrieve updated attribute.");
    }
    const updatedRow = resultNew.getColumnValue("row_data");
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // 7. Return the updated row as a VARIANT.
    return updatedRow;
    
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error(`Procedure UPDATE_ATTRIBUTE_WITH_CASCADE failed: ${err.message || err}`);
}
$$;


CALL delete_variant_group_after_attribute_type_changed(
    PARSE_JSON('{"TYPE": "text", "ATTRIBUTE_NAME": "Color"}'),
    'ATTRIBUTE_ID = 201'
);


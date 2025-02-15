file name = C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.1.js
line 5-35;

C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\api\addVariantItem\[bodyParser]addItem.js
61-74
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\api\unlinkVariant\unlinkVariants.js
11-27
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.2.js
20
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\product\updateProduct.js
277-287
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\product\updateProduct.js
310


CREATE OR REPLACE PROCEDURE update_attribute_index_and_variant_group_visibility(
    DATA_JSON VARIANT,   -- JSON with field name: value pairs for PRODUCT update
    whereClause STRING   -- WHERE clause for PRODUCT update (e.g., "PRODUCT_ID = 101")
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
        throw new Error("WHERE clause is required for update.");
    }
    
    const data = DATA_JSON;
    let setClauses = [];
    for (const key in data) {
        let val = data[key];
        if (typeof val === 'string') {
            val = val.replace(/'/g, "''");
            setClauses.push(`${key} = '${val}'`);
        } else if (typeof val === 'boolean') {
            setClauses.push(`${key} = ${val ? 'TRUE' : 'FALSE'}`);
        } else if (val === null) {
            setClauses.push(`${key} = NULL`);
        } else {
            setClauses.push(`${key} = ${val}`);
        }
    }
    
    const updateQuery = `
        UPDATE PRODUCT
        SET ${setClauses.join(", ")}
        WHERE ${whereClause}
    `;
    const stmtUpdate = snowflake.createStatement({ sqlText: updateQuery });
    stmtUpdate.execute();
    
    // Retrieve the updated product row as a JSON object.
    const selectUpdatedSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM PRODUCT
        WHERE ${whereClause}
        LIMIT 1
    `;
    const stmtSelectUpdated = snowflake.createStatement({ sqlText: selectUpdatedSQL });
    const resultUpdated = stmtSelectUpdated.execute();
    if (!resultUpdated.next()) {
        throw new Error("No product found for the given WHERE clause.");
    }
    const updatedRow = resultUpdated.getColumnValue("row_data");
    
    // Delete from PRODUCT_ATTRIBUTE_VALUE_INDEX where:
    // PRODUCT_ID equals updated productId and ATTRIBUTE_ID is not in (SELECT ATTRIBUTE_ID FROM ATTRIBUTE_GROUP_LINK WHERE GROUP_ID = updatedRow.GROUP_ID)
    const productId = updatedRow["PRODUCT_ID"];
    const groupId = updatedRow["GROUP_ID"];
    const variantGroupId = updatedRow["VARIANT_GROUP_ID"];
    
    const deleteQuery = `
        DELETE FROM PRODUCT_ATTRIBUTE_VALUE_INDEX
        WHERE PRODUCT_ID = ${productId}
          AND ATTRIBUTE_ID NOT IN (
              SELECT ATTRIBUTE_ID FROM ATTRIBUTE_GROUP_LINK WHERE GROUP_ID = ${groupId}
          )
    `;
    const stmtDelete = snowflake.createStatement({ sqlText: deleteQuery });
    stmtDelete.execute();
    
    // Update the corresponding VARIANT_GROUP's visibility.
    const updateVariantQuery = `
        UPDATE VARIANT_GROUP
        SET VISIBILITY = COALESCE(
            (
                SELECT IFF(MAX(CASE WHEN STATUS = TRUE THEN 1 ELSE 0 END) = 1, TRUE, FALSE)
                FROM PRODUCT
                WHERE VARIANT_GROUP_ID = ${variantGroupId}
                  AND STATUS = TRUE
                GROUP BY VARIANT_GROUP_ID
            ), FALSE
        )
        WHERE VARIANT_GROUP_ID = ${variantGroupId}
    `;
    const stmtUpdateVariant = snowflake.createStatement({ sqlText: updateVariantQuery });
    stmtUpdateVariant.execute();
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // Return the updated product row as a VARIANT.
    return updatedRow;
    
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error("Error: " + err);
}
$$;


CALL update_attribute_index_and_variant_group_visibility(
    PARSE_JSON('{"PRICE": 150.00, "STATUS": true}'),
    'PRODUCT_ID = 101'
);

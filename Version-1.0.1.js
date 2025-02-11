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


CREATE OR REPLACE PROCEDURE EVERSHOP_copy.PUBLIC.UPSERT_PRODUCT_WITH_TRIGGER(
    DATA_JSON VARIANT,   -- JSON with field name: value pairs for PRODUCT update
    WHERE_JSON VARIANT   -- JSON with a key "where" whose value is the WHERE clause for PRODUCT update
)
RETURNS STRING
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
  // Get the update values and WHERE clause.
  var data = DATA_JSON;
  var whereClause = (WHERE_JSON && WHERE_JSON.where) ? WHERE_JSON.where : null;
  if (!whereClause) {
    throw "WHERE clause is required for the update.";
  }
  
  // Build the update statement for PRODUCT.
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
  var updateQuery = "UPDATE EVERSHOP_copy.PUBLIC.PRODUCT SET " + setClauses.join(", ") + " WHERE " + whereClause;
  
  var stmtUpdate = snowflake.createStatement({ sqlText: updateQuery });
  stmtUpdate.execute();
  
  // Fetch the updated product record.
  var selectQuery = "SELECT PRODUCT_ID, GROUP_ID, VARIANT_GROUP_ID FROM EVERSHOP_copy.PUBLIC.PRODUCT WHERE " + whereClause;
  var stmtSelect = snowflake.createStatement({ sqlText: selectQuery });
  var resultSelect = stmtSelect.execute();
  if (!resultSelect.next()) {
    throw "No product found for the given WHERE clause.";
  }
  var productId = resultSelect.getColumnValue(1);
  var groupId   = resultSelect.getColumnValue(2);
  var variantGroupId = resultSelect.getColumnValue(3);
  
  // Delete from PRODUCT_ATTRIBUTE_VALUE_INDEX where:
  // product_id = updated productId AND attribute_id NOT IN (SELECT attribute_id FROM ATTRIBUTE_GROUP_LINK WHERE group_id = groupId)
  var deleteQuery = "DELETE FROM EVERSHOP_copy.PUBLIC.PRODUCT_ATTRIBUTE_VALUE_INDEX " +
                    "WHERE PRODUCT_ID = " + productId +
                    " AND ATTRIBUTE_ID NOT IN (SELECT ATTRIBUTE_ID FROM EVERSHOP_copy.PUBLIC.ATTRIBUTE_GROUP_LINK WHERE GROUP_ID = " + groupId + ")";
  var stmtDelete = snowflake.createStatement({ sqlText: deleteQuery });
  stmtDelete.execute();
  
  // Update the corresponding VARIANT_GROUP's visibility.
  // We simulate bool_or by computing MAX(CASE WHEN STATUS THEN 1 ELSE 0 END) over products with STATUS = TRUE.
  // If the maximum is 1 then visibility should be TRUE, else FALSE.
  var updateVariantQuery = "UPDATE EVERSHOP_copy.PUBLIC.VARIANT_GROUP " +
                           "SET VISIBILITY = COALESCE( " +
                           "  (SELECT IFF(MAX(CASE WHEN STATUS = TRUE THEN 1 ELSE 0 END) = 1, TRUE, FALSE) " +
                           "   FROM EVERSHOP_copy.PUBLIC.PRODUCT " +
                           "   WHERE VARIANT_GROUP_ID = " + variantGroupId +
                           "     AND STATUS = TRUE " +
                           "   GROUP BY VARIANT_GROUP_ID), " +
                           "  FALSE) " +
                           "WHERE VARIANT_GROUP_ID = " + variantGroupId;
  var stmtUpdateVariant = snowflake.createStatement({ sqlText: updateVariantQuery });
  stmtUpdateVariant.execute();
  
  return "Success: Product updated with PRODUCT_ID " + productId;
} catch(err) {
  return "Error: " + err;
}
$$;




-- Insert a product record.
-- This will auto-generate PRODUCT_ID (assume this becomes PRODUCT_ID = 1).
INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT 
    (TYPE, VARIANT_GROUP_ID, VISIBILITY, GROUP_ID, SKU, PRICE, STATUS)
VALUES 
    ('simple', 5, TRUE, 10, 'SKU-101', 100.00, FALSE);



-- Insert a variant group record.
-- Assume this becomes VARIANT_GROUP_ID = 5.
INSERT INTO EVERSHOP_COPY.PUBLIC.VARIANT_GROUP 
    (ATTRIBUTE_GROUP_ID, ATTRIBUTE_ONE, VISIBILITY)
VALUES 
    (100, 1, FALSE);



-- Insert a link allowing ATTRIBUTE_ID 200 for GROUP_ID 10.
INSERT INTO EVERSHOP_COPY.PUBLIC.ATTRIBUTE_GROUP_LINK 
    (ATTRIBUTE_ID, GROUP_ID)
VALUES 
    (200, 10);



-- Insert a record that is allowed (ATTRIBUTE_ID 200 is linked for GROUP_ID 10).
INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT_ATTRIBUTE_VALUE_INDEX 
    (PRODUCT_ID, ATTRIBUTE_ID, OPTION_ID, OPTION_TEXT)
VALUES 
    (1, 200, 2, 'Option B');

-- Insert a record that should be deleted (ATTRIBUTE_ID 201 is not allowed for GROUP_ID 10).
INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT_ATTRIBUTE_VALUE_INDEX 
    (PRODUCT_ID, ATTRIBUTE_ID, OPTION_ID, OPTION_TEXT)
VALUES 
    (1, 201, 1, 'Option A');



CALL EVERSHOP_COPY.PUBLIC.UPSERT_PRODUCT_WITH_TRIGGER(
    PARSE_JSON('{
        "SKU": "SKU-101-UPDATED",
        "STATUS": true
    }'),
    PARSE_JSON('{ "where": "PRODUCT_ID = 503" }')
);

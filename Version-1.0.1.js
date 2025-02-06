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
    PRODUCT_ID FLOAT, 
    GROUP_ID FLOAT, 
    VARIANT_GROUP_ID FLOAT
)
RETURNS STRING
LANGUAGE JAVASCRIPT
AS
$$
try {
    const productId = Math.floor(PRODUCT_ID);
    const groupId = Math.floor(GROUP_ID);
    const variantGroupId = Math.floor(VARIANT_GROUP_ID);

    snowflake.execute({ sqlText: "BEGIN TRANSACTION;" });

    var deleteStmt = `
        DELETE FROM product_attribute_value_index
        WHERE product_id = ${productId}
        AND attribute_id NOT IN (
            SELECT attribute_id 
            FROM attribute_group_link 
            WHERE group_id = ${groupId}
        )`;
    snowflake.execute({ sqlText: deleteStmt });

    var updateStmt = `
        UPDATE variant_group 
        SET visibility = COALESCE((
            SELECT MAX(CASE WHEN visibility = TRUE THEN 1 ELSE 0 END)
            FROM product 
            WHERE variant_group_id = ${variantGroupId} 
            AND status = TRUE
            GROUP BY variant_group_id
        ), FALSE)
        WHERE variant_group_id = ${variantGroupId}`;
    snowflake.execute({ sqlText: updateStmt });

    snowflake.execute({ sqlText: "COMMIT;" });
    return "Success"; 
    
} catch (err) {
    snowflake.execute({ sqlText: "ROLLBACK;" });
    return "Error: " + err.message;
}
$$;




-- Insert data into VARIANT_GROUP table
INSERT INTO EVERSHOP_COPY.PUBLIC.VARIANT_GROUP (VARIANT_GROUP_ID, ATTRIBUTE_GROUP_ID, ATTRIBUTE_ONE, ATTRIBUTE_TWO, ATTRIBUTE_THREE, ATTRIBUTE_FOUR, ATTRIBUTE_FIVE)
VALUES (101, 1, 10, 20, 30, 40, 50), (102, 2, 15, 25, 35, 45, 55);

-- Insert data into ATTRIBUTE_GROUP_LINK table
INSERT INTO EVERSHOP_COPY.PUBLIC.ATTRIBUTE_GROUP_LINK (ATTRIBUTE_ID, GROUP_ID)
VALUES (1, 101), (2, 102);

-- Insert data into PRODUCT table with STATUS = FALSE initially
INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT (PRODUCT_ID, VARIANT_GROUP_ID, SKU, PRICE, STATUS, VISIBILITY)
VALUES (1001, 101, 'SKU001', 100.0, FALSE, TRUE), (1002, 102, 'SKU002', 200.0, FALSE, TRUE);



-- Update PRODUCT statuses to TRUE
UPDATE EVERSHOP_COPY.PUBLIC.PRODUCT
SET STATUS = TRUE
WHERE PRODUCT_ID IN (1001, 1002);


-- Execute the procedure with correct parameters
CALL update_attribute_index_and_variant_group_visibility(1001, 101, 101);



CREATE OR REPLACE PROCEDURE update_product_details(setData JSON, whereData JSON)
RETURNS STRING
LANGUAGE JAVASCRIPT
AS
$$
    // Extract key-value pair from SET JSON
    let setKey = Object.keys(setData)[0];
    let setValue = setData[setKey];

    // Extract key-value pair from WHERE JSON
    let whereKey = Object.keys(whereData)[0];
    let whereValue = whereData[whereKey];

    // Construct the UPDATE query dynamically
    let updateStmt = `
        UPDATE product
        SET ${setKey} = ${setValue}  -- Handles dynamic references
        WHERE ${whereKey} = '${whereValue}'`;

    // Execute the update statement
    snowflake.execute({ sqlText: updateStmt });

try {
    snowflake.execute({ sqlText: "BEGIN TRANSACTION;" });

    // Delete unwanted attribute values
    var deleteStmt = `
        DELETE FROM product_attribute_value_index
        WHERE product_id = ${whereValue}
        AND attribute_id NOT IN (
            SELECT attribute_id 
            FROM attribute_group_link 
            WHERE group_id = ${setValue}  -- Using setValue dynamically
        )`;
    snowflake.execute({ sqlText: deleteStmt });

    // Update variant group visibility
    var updateStmt2 = `
        UPDATE variant_group 
        SET visibility = COALESCE((
            SELECT MAX(CASE WHEN visibility = TRUE THEN 1 ELSE 0 END)
            FROM product 
            WHERE variant_group_id = ${setValue} 
            AND status = TRUE
            GROUP BY variant_group_id
        ), FALSE)
        WHERE variant_group_id = ${setValue}`;
    snowflake.execute({ sqlText: updateStmt2 });

    snowflake.execute({ sqlText: "COMMIT;" });
    return "Success"; 
    
} catch (err) {
    snowflake.execute({ sqlText: "ROLLBACK;" });
    return "Error: " + err.message;
}
$$;


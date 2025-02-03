file name = C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.1.js
line 5-35;
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

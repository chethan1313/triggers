FILENAME=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.0.js

LINE=502-686


CREATE OR REPLACE PROCEDURE prevent_delete_default_attribute_group(attribute_group_id FLOAT)
RETURNS STRING
LANGUAGE JAVASCRIPT
AS 
$$
try {
    // Retrieve the parameter using the arguments array
    var group_id = arguments[0];  

    if (group_id === 1) {
        return 'Error: Cannot delete default attribute group';
    }

    // Delete the attribute group (use binds for security)
    var sql_command = `DELETE FROM EVERSHOP_COPY.PUBLIC.ATTRIBUTE_GROUP WHERE ATTRIBUTE_GROUP_ID = ?`;
    snowflake.execute({
        sqlText: sql_command,
        binds: [group_id]  // Pass parameter safely
    });

    return 'Attribute group deleted successfully';

} catch (err) {
    return 'Error: ' + err.message;
}
$$;

-- Insert Attribute Groups
INSERT INTO EVERSHOP_COPY.PUBLIC.ATTRIBUTE_GROUP (ATTRIBUTE_GROUP_ID, GROUP_NAME)
VALUES (1, 'Default Group'), (2, 'Electronics'), (3, 'Clothing');

-- Insert Products
INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT (PRODUCT_ID, GROUP_ID, VARIANT_GROUP_ID, SKU, PRICE, STATUS)
VALUES (1001, 1, NULL, 'SKU-001', 100.00, TRUE),
       (1002, 2, 10, 'SKU-002', 200.00, TRUE), -- Product with Variant Group
       (1003, 3, NULL, 'SKU-003', 150.00, TRUE);

CALL prevent_delete_default_attribute_group(1);--DOES NOT DELETE 
CALL prevent_delete_default_attribute_group(2);--DELETES AS IT IS NON DEFAULT 

*************************************************************************************************************
CREATE OR REPLACE PROCEDURE prevent_change_attribute_group(product_id FLOAT, new_group_id FLOAT)
RETURNS STRING
LANGUAGE JAVASCRIPT
AS 
$$
try {
    var prod_id = arguments[0];  
    var new_grp_id = arguments[1];

    // Check if the product has a variant group
    var checkQuery = `SELECT VARIANT_GROUP_ID FROM EVERSHOP_COPY.PUBLIC.PRODUCT WHERE PRODUCT_ID = ?`;
    var checkResult = snowflake.execute({ sqlText: checkQuery, binds: [prod_id] });

    var variant_group_id = null;
    if (checkResult.next()) {
        variant_group_id = checkResult.getColumnValue(1);
    }

    if (variant_group_id !== null) {
        return 'Error: Cannot change attribute group of product with variants';
    }

    // Update the product's attribute group
    var updateQuery = `UPDATE EVERSHOP_COPY.PUBLIC.PRODUCT SET GROUP_ID = ? WHERE PRODUCT_ID = ?`;
    snowflake.execute({ sqlText: updateQuery, binds: [new_grp_id, prod_id] });

    return 'Attribute group updated successfully';

} catch (err) {
    return 'Error: ' + err.message;
}
$$;

CALL prevent_change_attribute_group(1002, 3);---DOESN'T CHANGE ATTRIBUTE GROUP
CALL prevent_change_attribute_group(1001, 3);--CHANGES

****************************************************************************

CREATE OR REPLACE PROCEDURE remove_attribute_from_group(attribute_id FLOAT, group_id FLOAT)
RETURNS STRING
LANGUAGE JAVASCRIPT
AS 
$$
try {
    var attr_id = arguments[0];  
    var grp_id = arguments[1];

    // Delete product attribute values linked to this attribute
    var deleteProductAttrQuery = `DELETE FROM EVERSHOP_COPY.PUBLIC.PRODUCT_ATTRIBUTE_VALUE_INDEX 
                                  WHERE ATTRIBUTE_ID = ? 
                                  AND PRODUCT_ID IN 
                                      (SELECT PRODUCT_ID FROM EVERSHOP_COPY.PUBLIC.PRODUCT WHERE GROUP_ID = ?)`;

    snowflake.execute({ sqlText: deleteProductAttrQuery, binds: [attr_id, grp_id] });

    // Delete variant groups related to this attribute
    var deleteVariantGroupQuery = `DELETE FROM EVERSHOP_COPY.PUBLIC.VARIANT_GROUP 
                                   WHERE ATTRIBUTE_GROUP_ID = ? 
                                   AND (ATTRIBUTE_ONE = ? OR ATTRIBUTE_TWO = ? OR ATTRIBUTE_THREE = ? OR ATTRIBUTE_FOUR = ? OR ATTRIBUTE_FIVE = ?)`;

    snowflake.execute({ sqlText: deleteVariantGroupQuery, binds: [grp_id, attr_id, attr_id, attr_id, attr_id, attr_id] });

    return 'Attribute removed from group successfully';

} catch (err) {
    return 'Error: ' + err.message;
}
$$;

INSERT INTO EVERSHOP_COPY.PUBLIC.ATTRIBUTE_GROUP_LINK (ATTRIBUTE_ID, GROUP_ID) VALUES
(101, 3),
(102, 3),
(103, 4);

INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT_ATTRIBUTE_VALUE_INDEX (PRODUCT_ID, ATTRIBUTE_ID, OPTION_ID, OPTION_TEXT) VALUES
(1001, 101, 1, 'Red'),
(1002, 101, 2, 'Blue'),
(1003, 102, 1, 'Small'),
(1004, 103, 2, 'Large');

INSERT INTO EVERSHOP_COPY.PUBLIC.VARIANT_GROUP (ATTRIBUTE_GROUP_ID, ATTRIBUTE_ONE, ATTRIBUTE_TWO, ATTRIBUTE_THREE) VALUES
(3, 101, 102, 103),
(4, 103, NULL, NULL);

CALL remove_attribute_from_group(101, 3);  --DELETES ROW IN BOTH TABLES VARIANT_GROUP,PRODUCT_ATTRIBUTE_VALUE_INDEX

*************************************************************************
    
CREATE OR REPLACE PROCEDURE update_product_attribute_option_value_text(
    attribute_option_id FLOAT, 
    attribute_id FLOAT, 
    new_option_text STRING
)
RETURNS STRING
LANGUAGE JAVASCRIPT
AS 
$$
try {
    var option_id = arguments[0];  
    var attr_id = arguments[1];
    var new_text = arguments[2];

    var updateQuery = `UPDATE EVERSHOP_COPY.PUBLIC.PRODUCT_ATTRIBUTE_VALUE_INDEX 
                       SET OPTION_TEXT = ? 
                       WHERE OPTION_ID = ? AND ATTRIBUTE_ID = ?`;

    snowflake.execute({ sqlText: updateQuery, binds: [new_text, option_id, attr_id] });

    return 'Product attribute option text updated successfully';

} catch (err) {
    return 'Error: ' + err.message;
}
$$;


INSERT INTO EVERSHOP_COPY.PUBLIC.ATTRIBUTE_OPTION (ATTRIBUTE_ID, ATTRIBUTE_CODE, OPTION_TEXT)
VALUES 
(201, 'color', 'Red'),
(202, 'size', 'Small');

INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT_ATTRIBUTE_VALUE_INDEX (PRODUCT_ID, ATTRIBUTE_ID, OPTION_ID, OPTION_TEXT)
VALUES 
(1001, 201, 1, 'Red'),
(1002, 202, 2, 'Small');

INSERT INTO EVERSHOP_COPY.PUBLIC.VARIANT_GROUP (ATTRIBUTE_GROUP_ID, ATTRIBUTE_ONE, VISIBILITY)
VALUES 
(1, 201, FALSE);

CALL update_product_attribute_option_value_text(1, 201, 'Blue');--PRODUCT_ATTRIBUTE_VALUE_INDEX IS UPDATED WITH THE OPTION TEXT

*******************************************************************************************

    CREATE OR REPLACE PROCEDURE delete_product_attribute_value_index(
    attribute_option_id FLOAT, 
    attribute_id FLOAT
)
RETURNS STRING
LANGUAGE JAVASCRIPT
AS 
$$
try {
    var option_id = arguments[0];  
    var attr_id = arguments[1];

    var deleteQuery = `DELETE FROM EVERSHOP_COPY.PUBLIC.PRODUCT_ATTRIBUTE_VALUE_INDEX 
                       WHERE OPTION_ID = ? AND ATTRIBUTE_ID = ?`;

    snowflake.execute({ sqlText: deleteQuery, binds: [option_id, attr_id] });

    return 'Product attribute value index deleted successfully';

} catch (err) {
    return 'Error: ' + err.message;
}
$$;

CALL delete_product_attribute_value_index(2, 103); --WHEN A row is deleted from ATTRIBUTE_OPTION 

***************************************************************************

CREATE OR REPLACE PROCEDURE update_variant_group_visibility(variant_group_id FLOAT)
RETURNS STRING
LANGUAGE JAVASCRIPT
AS 
$$
try {
    var vg_id = arguments[0];

    var updateQuery = `UPDATE EVERSHOP_COPY.PUBLIC.VARIANT_GROUP 
                       SET VISIBILITY = (
                           SELECT CASE 
                                      WHEN MAX(CASE WHEN STATUS = TRUE THEN 1 ELSE 0 END) = 1 
                                      THEN TRUE 
                                      ELSE FALSE 
                                  END
                           FROM EVERSHOP_COPY.PUBLIC.PRODUCT 
                           WHERE VARIANT_GROUP_ID = ?
                       ) 
                       WHERE VARIANT_GROUP_ID = ?`;

    snowflake.execute({ sqlText: updateQuery, binds: [vg_id, vg_id] });

    return 'Variant group visibility updated successfully';

} catch (err) {
    return 'Error: ' + err.message;
}
$$;

-- Insert into VARIANT_GROUP
INSERT INTO EVERSHOP_COPY.PUBLIC.VARIANT_GROUP (VARIANT_GROUP_ID, ATTRIBUTE_GROUP_ID, VISIBILITY)
VALUES (100, 10, FALSE);

-- Insert into PRODUCT (Initial Visibility FALSE)
INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT (PRODUCT_ID, VARIANT_GROUP_ID, STATUS, VISIBILITY, SKU, PRICE)
VALUES (2001, 100, FALSE, FALSE, 'SKU-001', 100.00);

CALL update_variant_group_visibility(100);--IN VARIANT_GROUP THE VISIBILITY IS CHANGED TO TRUE

*********************************************************************************************

CREATE OR REPLACE PROCEDURE update_attribute_index_and_variant_group_visibility(
    NEW_PRODUCT_ID FLOAT, 
    NEW_GROUP_ID FLOAT, 
    NEW_VARIANT_GROUP_ID FLOAT
)
RETURNS STRING
LANGUAGE JAVASCRIPT
AS
$$
try {
    // Delete from product_attribute_value_index
    snowflake.execute({
        sqlText: `DELETE FROM EVERSHOP_COPY.PUBLIC.PRODUCT_ATTRIBUTE_VALUE_INDEX
                  WHERE PRODUCT_ID = ? 
                  AND ATTRIBUTE_ID NOT IN (
                      SELECT ATTRIBUTE_ID FROM EVERSHOP_COPY.PUBLIC.ATTRIBUTE_GROUP_LINK 
                      WHERE GROUP_ID = ?
                  )`,
        binds: [NEW_PRODUCT_ID, NEW_GROUP_ID]
    });

    // Update variant_group visibility
    snowflake.execute({
        sqlText: `UPDATE EVERSHOP_COPY.PUBLIC.VARIANT_GROUP
                  SET VISIBILITY = COALESCE((
                      SELECT MAX(CASE WHEN VISIBILITY THEN 1 ELSE 0 END) 
                      FROM EVERSHOP_COPY.PUBLIC.PRODUCT 
                      WHERE VARIANT_GROUP_ID = ? 
                      AND STATUS = TRUE 
                      GROUP BY VARIANT_GROUP_ID
                  ), 0)
                  WHERE VARIANT_GROUP_ID = ?`,
        binds: [NEW_VARIANT_GROUP_ID, NEW_VARIANT_GROUP_ID]
    });

    return "Success";
} catch (err) {
    return "Failed: " + JSON.stringify(err);
}
$$;


-- Insert sample data into the product table
INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT (PRODUCT_ID, VARIANT_GROUP_ID, GROUP_ID, SKU, PRICE, STATUS) VALUES
(1, 1, 1, 'SKU001', 100.00, TRUE),
(2, 1, 1, 'SKU002', 200.00, TRUE),
(3, 2, 2, 'SKU003', 300.00, FALSE);

-- Insert sample data into the product_attribute_value_index table
INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT_ATTRIBUTE_VALUE_INDEX (PRODUCT_ID, ATTRIBUTE_ID, OPTION_ID) VALUES
(1, 1, 1),
(1, 2, 2),
(2, 1, 1),
(3, 3, 3);

-- Insert sample data into the variant_group table
INSERT INTO EVERSHOP_COPY.PUBLIC.VARIANT_GROUP (VARIANT_GROUP_ID, ATTRIBUTE_GROUP_ID, VISIBILITY) VALUES
(1, 1, FALSE),
(2, 2, FALSE);

-- Call the stored procedure with sample data
CALL update_attribute_index_and_variant_group_visibility(1, 1, 1);--DELETES ROW IN PRODUCT ATTRIBUTE INDEX AND CHANGES VISIBILITY IN VARIANT_GROUP TABLE

************************************************************************************************

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.delete_variant_group_after_attribute_type_changed(
    OLD_ATTRIBUTE_ID FLOAT,
    OLD_TYPE STRING,
    NEW_TYPE STRING
)
RETURNS STRING
LANGUAGE JAVASCRIPT
AS
$$
try {
    if (OLD_TYPE === 'select' && NEW_TYPE !== 'select') {
        snowflake.execute({
            sqlText: `DELETE FROM EVERSHOP_COPY.PUBLIC.VARIANT_GROUP 
                      WHERE ATTRIBUTE_ONE = ? 
                         OR ATTRIBUTE_TWO = ? 
                         OR ATTRIBUTE_THREE = ? 
                         OR ATTRIBUTE_FOUR = ? 
                         OR ATTRIBUTE_FIVE = ?`,
            binds: [OLD_ATTRIBUTE_ID, OLD_ATTRIBUTE_ID, OLD_ATTRIBUTE_ID, OLD_ATTRIBUTE_ID, OLD_ATTRIBUTE_ID]
        });
    }
    return "Success";
} catch (err) {
    return "Failed: " + JSON.stringify(err);
}
$$;


-- Insert into ATTRIBUTE Table
INSERT INTO EVERSHOP_COPY.PUBLIC.ATTRIBUTE (ATTRIBUTE_ID, ATTRIBUTE_CODE, ATTRIBUTE_NAME, TYPE)
VALUES (1, 'color', 'Color', 'select'),
       (2, 'size', 'Size', 'select'),
       (3, 'weight', 'Weight', 'number');

-- Insert into VARIANT_GROUP Table
INSERT INTO EVERSHOP_COPY.PUBLIC.VARIANT_GROUP (VARIANT_GROUP_ID, ATTRIBUTE_GROUP_ID, ATTRIBUTE_ONE, ATTRIBUTE_TWO, ATTRIBUTE_THREE, ATTRIBUTE_FOUR, ATTRIBUTE_FIVE, VISIBILITY)
VALUES (1, 1, 1, 2, NULL, NULL, NULL, TRUE),
       (2, 1, 1, NULL, NULL, NULL, NULL, TRUE),
       (3, 2, 2, NULL, NULL, NULL, NULL, FALSE);

CALL EVERSHOP_COPY.PUBLIC.delete_variant_group_after_attribute_type_changed(1, 'select', 'text');--ROWS WITH THE ATTRIBUTE_GROUP_ID 1 WILL BE DELETED  

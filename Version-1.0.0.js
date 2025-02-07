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

**********************************

filename=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\migration\Version-1.0.0.js

line=72-92

CREATE OR REPLACE PROCEDURE DELETE_CUSTOMER_GROUP(group_id FLOAT)
RETURNS STRING
LANGUAGE JAVASCRIPT
AS
$$
    try {
        // Prevent deletion of group_id = 1
        if (GROUP_ID === 1) {
            throw "Cannot delete default customer group (ID = 1)";
        }

        // Execute deletion
        snowflake.execute({
            sqlText: `DELETE FROM EVERSHOP_COPY.PUBLIC.CUSTOMER_GROUP WHERE CUSTOMER_GROUP_ID = ?`,
            binds: [GROUP_ID]
        });

        return "Deletion successful."; 
    } 
    catch (err) {
        return "Error: " + err;
    }
$$;

INSERT INTO EVERSHOP_COPY.PUBLIC.CUSTOMER_GROUP (GROUP_NAME) VALUES 
    ('Default Group'), -- This will get ID = 1
    ('VIP Customers'),
    ('Wholesale Buyers');

CALL DELETE_CUSTOMER_GROUP(1); --to call the default group
CALL DELETE_CUSTOMER_GROUP(2); --to call the non default group

****************************************************************************************************************

  line=95-116

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.SET_DEFAULT_GROUP()
RETURNS STRING
LANGUAGE SQL
EXECUTE AS CALLER
AS 
$$
BEGIN
  -- Ensure GROUP_ID is set to 1 if it is NULL
  UPDATE EVERSHOP_COPY.PUBLIC.CUSTOMER
  SET GROUP_ID = 1
  WHERE GROUP_ID IS NULL;

  RETURN 'Default group_id set successfully!';
END;
$$;


INSERT INTO EVERSHOP_COPY.PUBLIC.CUSTOMER (EMAIL, PASSWORD, FULL_NAME, GROUP_ID) 
VALUES 
    ('john.doe@example.com', 'hashedpassword1', 'John Doe', NULL),
    ('jane.doe@example.com', 'hashedpassword2', 'Jane Doe', NULL),
    ('mike.smith@example.com', 'hashedpassword3', 'Mike Smith', 2);

CALL EVERSHOP_COPY.PUBLIC.SET_DEFAULT_GROUP();

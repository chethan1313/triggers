FILENAME=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\migration\Version-1.0.1.js

line=6=66

update+++++++++
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\api\updateCustomer\updateCustomer.js
41
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\services\customer\updatePassword.js
18
delete++++++++++
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\pages\frontStore\all\[context]auth.js
30
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\services\customer\deleteCustomer.js
14
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\services\customer\updateCustomer.js
55
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\services\customer\loginCustomerWithEmail.js
28
insert++++++++++
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\customer\services\customer\createCustomer.js
45


for inserting while creating customer 

CREATE OR REPLACE PROCEDURE create_customer(
  status float,
  group_id float,
  email VARCHAR,
  password VARCHAR,
  full_name VARCHAR
)
RETURNS STRING
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
  snowflake.execute({ sqlText: "BEGIN;" });

  // Insert customer
  snowflake.execute({
    sqlText: `INSERT INTO customer (status, group_id, email, password, full_name)
              VALUES (?, ?, ?, ?, ?);`,
    binds: [STATUS, GROUP_ID, EMAIL, PASSWORD, FULL_NAME]
  });

  // Retrieve the inserted customer data
  var getCustomer = snowflake.execute({
    sqlText: `SELECT *
              FROM customer
              WHERE email = ?
              ORDER BY created_at DESC
              LIMIT 1;`,
    binds: [EMAIL]
  });

  if (getCustomer.next()) {
    var custData = {
      CUSTOMER_ID: getCustomer.getColumnValue('CUSTOMER_ID'),
      UUID: getCustomer.getColumnValue('UUID'),
      STATUS: getCustomer.getColumnValue('STATUS'),
      GROUP_ID: getCustomer.getColumnValue('GROUP_ID'),
      EMAIL: getCustomer.getColumnValue('EMAIL'),
      PASSWORD: getCustomer.getColumnValue('PASSWORD'),
      FULL_NAME: getCustomer.getColumnValue('FULL_NAME'),
      CREATED_AT: getCustomer.getColumnValue('CREATED_AT'),
      UPDATED_AT: getCustomer.getColumnValue('UPDATED_AT')
    };

    // Insert event
    snowflake.execute({
      sqlText: `INSERT INTO event (name, data)
                SELECT 'customer_created', PARSE_JSON(?);`,
      binds: [JSON.stringify(custData)]
    });
  } else {
    throw "Failed to retrieve inserted customer data.";
  }

  snowflake.execute({ sqlText: "COMMIT;" });
  return "Customer created successfully.";
} catch (err) {
  snowflake.execute({ sqlText: "ROLLBACK;" });
  return "ERROR: " + err;
}
$$;

CALL create_customer(
  1,                      -- status
  1,                      -- group_id
  'john.doe@example.com', -- email
  'securepassword123',    -- password
  'John Doe'              -- full_name
);


for inserting into event while updating the customer ____________________________

CREATE OR REPLACE PROCEDURE update_customer(
  customer_id float,
  status float,
  group_id float,
  email VARCHAR,
  password VARCHAR,
  full_name VARCHAR
)
RETURNS STRING
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
  snowflake.execute({ sqlText: "BEGIN;" });

  // Update customer
  snowflake.execute({
    sqlText: `UPDATE customer
              SET status = ?, group_id = ?, email = ?, 
                  password = ?, full_name = ?, updated_at = CURRENT_TIMESTAMP()
              WHERE customer_id = ?;`,
    binds: [STATUS, GROUP_ID, EMAIL, PASSWORD, FULL_NAME, CUSTOMER_ID]
  });

  // Retrieve the updated customer data
  var getCustomer = snowflake.execute({
    sqlText: `SELECT *
              FROM customer
              WHERE customer_id = ?;`,
    binds: [CUSTOMER_ID]
  });

  if (getCustomer.next()) {
    var custData = {
      CUSTOMER_ID: getCustomer.getColumnValue('CUSTOMER_ID'),
      UUID: getCustomer.getColumnValue('UUID'),
      STATUS: getCustomer.getColumnValue('STATUS'),
      GROUP_ID: getCustomer.getColumnValue('GROUP_ID'),
      EMAIL: getCustomer.getColumnValue('EMAIL'),
      PASSWORD: getCustomer.getColumnValue('PASSWORD'),
      FULL_NAME: getCustomer.getColumnValue('FULL_NAME'),
      CREATED_AT: getCustomer.getColumnValue('CREATED_AT'),
      UPDATED_AT: getCustomer.getColumnValue('UPDATED_AT')
    };

    // Insert event
    snowflake.execute({
      sqlText: `INSERT INTO event (name, data)
                SELECT 'customer_updated', PARSE_JSON(?);`,
      binds: [JSON.stringify(custData)]
    });
  } else {
    throw "Customer not found.";
  }

  snowflake.execute({ sqlText: "COMMIT;" });
  return "Customer updated successfully.";
} catch (err) {
  snowflake.execute({ sqlText: "ROLLBACK;" });
  return "ERROR: " + err;
}
$$;

CALL update_customer(
  301,                      -- customer_id
  2,                      -- new status
  1,                      -- group_id
  'john.new@example.com', -- new email
  'newpassword456',       -- new password
  'John H. Doe'           -- new full_name
);


for inserting while deleting the customer_________________________

CREATE OR REPLACE PROCEDURE delete_customer(customer_id float)
RETURNS STRING
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
  snowflake.execute({ sqlText: "BEGIN;" });

  // Retrieve the customer data before deletion
  var getCustomer = snowflake.execute({
    sqlText: `SELECT *
              FROM customer
              WHERE customer_id = ?;`,
    binds: [CUSTOMER_ID]
  });

  if (getCustomer.next()) {
    var custData = {
      CUSTOMER_ID: getCustomer.getColumnValue('CUSTOMER_ID'),
      UUID: getCustomer.getColumnValue('UUID'),
      STATUS: getCustomer.getColumnValue('STATUS'),
      GROUP_ID: getCustomer.getColumnValue('GROUP_ID'),
      EMAIL: getCustomer.getColumnValue('EMAIL'),
      PASSWORD: getCustomer.getColumnValue('PASSWORD'),
      FULL_NAME: getCustomer.getColumnValue('FULL_NAME'),
      CREATED_AT: getCustomer.getColumnValue('CREATED_AT'),
      UPDATED_AT: getCustomer.getColumnValue('UPDATED_AT')
    };

    // Delete customer
    snowflake.execute({
      sqlText: `DELETE FROM customer
                WHERE customer_id = ?;`,
      binds: [CUSTOMER_ID]
    });

    // Insert event
    snowflake.execute({
      sqlText: `INSERT INTO event (name, data)
                SELECT 'customer_deleted', PARSE_JSON(?);`,
      binds: [JSON.stringify(custData)]
    });
  } else {
    throw "Customer not found.";
  }

  snowflake.execute({ sqlText: "COMMIT;" });
  return "Customer deleted successfully.";
} catch (err) {
  snowflake.execute({ sqlText: "ROLLBACK;" });
  return "ERROR: " + err;
}
$$;

CALL delete_customer(201);  -- customer_id

trigger file=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.2.js

  line=26-65

insert or update on category_description
filename=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.0.js
414
433
452
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\category\createCategory.js
50
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\category\updateCategory.js
61


insert or update on product_description
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.4.js
68
103
138
173
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\product\createProduct.js
165
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\product\updateProduct.js
290



CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.UPSERT_CATEGORY_DESCRIPTION(
    DATA_JSON VARIANT,  -- JSON with column values (must include NAME if URL_KEY is null/empty)
    WHERE_JSON VARIANT  -- JSON with a key "where" containing the WHERE clause (NULL for INSERT)
)
RETURNS STRING
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
  // Convert the input JSON to a JavaScript object.
  var data = DATA_JSON;
  var whereClause = (WHERE_JSON && WHERE_JSON.where) ? WHERE_JSON.where : null;
  
  // Mimic the PostgreSQL trigger logic:
  // If URL_KEY is null or empty, then generate it from NAME.
  if (!data.hasOwnProperty("URL_KEY") ||
      data.URL_KEY === null ||
      (typeof data.URL_KEY === 'string' && data.URL_KEY.trim() === '')) {
      
    // Require NAME to generate URL_KEY.
    if (!data.hasOwnProperty("NAME") || data.NAME === null) {
      throw "Missing required field: NAME";
    }
    var name = data.NAME;
    // Replace non-alphanumeric characters with a hyphen.
    var urlKey = name.replace(/[^a-zA-Z0-9]+/g, '-');
    // Remove leading/trailing hyphens.
    urlKey = urlKey.replace(/^-|-$/g, '');
    // Convert to lowercase.
    urlKey = urlKey.toLowerCase();
    // Append a hyphen and a random number.
    var randomSuffix = Math.floor(Math.random() * 1000000);
    urlKey = urlKey + '-' + randomSuffix;
    data.URL_KEY = urlKey;
  } else {
    // If URL_KEY is provided (non-empty), validate that it doesn't contain '/', '\' or '#'.
    if (/[\/\\#]/.test(data.URL_KEY)) {
      throw "Invalid url_key: " + data.URL_KEY;
    }
  }
  
  // Build the dynamic SQL query.
  var query = "";
  if (!whereClause) {
    // Build an INSERT query.
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
        values.push(val ? 'TRUE' : 'FALSE');
      } else if (val === null) {
        values.push("NULL");
      } else {
        values.push(val.toString());
      }
    }
    query = "INSERT INTO EVERSHOP_COPY.PUBLIC.CATEGORY_DESCRIPTION (" + columns.join(", ") + ") VALUES (" + values.join(", ") + ")";
  } else {
    // Build an UPDATE query.
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
    query = "UPDATE EVERSHOP_COPY.PUBLIC.CATEGORY_DESCRIPTION SET " + setClauses.join(", ") + " WHERE " + whereClause;
  }
  
  // Execute the dynamic SQL query.
  var stmt = snowflake.createStatement({ sqlText: query });
  stmt.execute();
  
  return (whereClause ? "Success: Update completed" : "Success: Insert completed");
} catch (err) {
  return "Error: " + err;
}
$$;


CALL EVERSHOP_COPY.PUBLIC.UPSERT_CATEGORY_DESCRIPTION(
  PARSE_JSON('{
    "CATEGORY_DESCRIPTION_CATEGORY_ID":201,
    "NAME": "New Category Description111111",
    "SHORT_DESCRIPTION": "A short description",
    "META_DESCRIPTION":"LLLLLLLLLLLL",
    "URL_KEY":null
  }'),
  NULL
);


CALL EVERSHOP_COPY.PUBLIC.UPSERT_CATEGORY_DESCRIPTION(
  PARSE_JSON('{
    "NAME": "Updated Category Description",
    "SHORT_DESCRIPTION": "Updated short description",
    "META_TITLE": "kk"
    
  }'),
  PARSE_JSON('{"where": "CATEGORY_DESCRIPTION_ID = 1108"}')
);


+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

  CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.UPSERT_PRODUCT_DESCRIPTION(
    DATA_JSON VARIANT,  -- JSON with column values (for insert, must include NAME and PRODUCT_DESCRIPTION_PRODUCT_ID)
    WHERE_JSON VARIANT  -- JSON with a key "where" containing the WHERE clause (NULL for INSERT)
)
RETURNS STRING
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
  // Convert input JSON to a JavaScript object.
  var data = DATA_JSON;
  var whereClause = (WHERE_JSON && WHERE_JSON.where) ? WHERE_JSON.where : null;
  
  if (!whereClause) {
    // INSERT operation: require NAME and PRODUCT_DESCRIPTION_PRODUCT_ID.
    if (!data.hasOwnProperty("NAME") || data.NAME === null) {
      throw "Missing required field: NAME";
    }
    if (!data.hasOwnProperty("PRODUCT_DESCRIPTION_PRODUCT_ID") || data.PRODUCT_DESCRIPTION_PRODUCT_ID === null) {
      throw "Missing required field: PRODUCT_DESCRIPTION_PRODUCT_ID";
    }
    // For new rows: if URL_KEY is missing or empty, generate one from NAME.
    if (
         !data.hasOwnProperty("URL_KEY") ||
         data.URL_KEY === null ||
         (typeof data.URL_KEY === 'string' && data.URL_KEY.trim() === '')
       ) {
      var name = data.NAME;
      var urlKey = name.replace(/[^a-zA-Z0-9]+/g, '-'); // Replace non-alphanumeric with hyphen.
      urlKey = urlKey.replace(/^-|-$/g, '');              // Trim leading/trailing hyphens.
      urlKey = urlKey.toLowerCase();                      // Convert to lowercase.
      var randomSuffix = Math.floor(Math.random() * 1000000); // Random number.
      urlKey = urlKey + '-' + randomSuffix;
      data.URL_KEY = urlKey;
    }
    // If URL_KEY is provided (non-empty), use it as is.
    
  } else {
    // UPDATE operation: fields are optional.
    // If NAME is provided and URL_KEY is missing or empty, generate a new URL_KEY.
    if (
         data.hasOwnProperty("NAME") &&
         data.NAME &&
         (
           !data.hasOwnProperty("URL_KEY") ||
           data.URL_KEY === null ||
           (typeof data.URL_KEY === 'string' && data.URL_KEY.trim() === '')
         )
       ) {
      var name = data.NAME;
      var urlKey = name.replace(/[^a-zA-Z0-9]+/g, '-');
      urlKey = urlKey.replace(/^-|-$/g, '');
      urlKey = urlKey.toLowerCase();
      var randomSuffix = Math.floor(Math.random() * 1000000);
      urlKey = urlKey + '-' + randomSuffix;
      data.URL_KEY = urlKey;
    } else if (
         data.hasOwnProperty("URL_KEY") &&
         typeof data.URL_KEY === 'string' &&
         data.URL_KEY.trim() !== ''
       ) {
      // If URL_KEY is provided (non-empty), validate that it doesn't contain '/', '\' or '#'.
      if (/[\/\\#]/.test(data.URL_KEY)) {
        throw "Invalid url_key: " + data.URL_KEY;
      }
    }
  }
  
  // Build the dynamic SQL query.
  var query = "";
  if (!whereClause) {
    // Build an INSERT query.
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
        values.push(val ? 'TRUE' : 'FALSE');
      } else if (val === null) {
        values.push("NULL");
      } else {
        values.push(val.toString());
      }
    }
    query = "INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT_DESCRIPTION (" + columns.join(", ") + ") VALUES (" + values.join(", ") + ")";
  } else {
    // Build an UPDATE query.
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
    query = "UPDATE EVERSHOP_COPY.PUBLIC.PRODUCT_DESCRIPTION SET " + setClauses.join(", ") + " WHERE " + whereClause;
  }
  
  // Execute the dynamic SQL query.
  var stmt = snowflake.createStatement({ sqlText: query });
  stmt.execute();
  
  return (whereClause ? "Success: Update completed" : "Success: Insert completed");
} catch (err) {
  return "Error: " + err;
}
$$;

CALL EVERSHOP_COPY.PUBLIC.UPSERT_PRODUCT_DESCRIPTION(
  PARSE_JSON('{
    "PRODUCT_DESCRIPTION_PRODUCT_ID": 500,
    "NAME": "New Product Description",
    "DESCRIPTION": "Detailed description here",
    "SHORT_DESCRIPTION": "Short desc",
    "URL_KEY": ""
  }'),
  NULL
);

CALL EVERSHOP_COPY.PUBLIC.UPSERT_PRODUCT_DESCRIPTION(
  PARSE_JSON('{
    "NAME": "Updated Product Description",
    "DESCRIPTION": "Updated detailed description",
    "URL_KEY": ""
  }'),
  PARSE_JSON('{"where": "PRODUCT_DESCRIPTION_ID = 123"}')
);




line-229-257****************************************

CREATE OR REPLACE PROCEDURE delete_sub_categories(category_id STRING)
RETURNS STRING
LANGUAGE JAVASCRIPT
AS
$$
try {
    // Recursive CTE to find all subcategories
    var sql = `
        WITH RECURSIVE sub_categories AS (
            SELECT category_id FROM category WHERE parent_id = ?
            UNION ALL
            SELECT c.category_id FROM category c
            INNER JOIN sub_categories sc ON c.parent_id = sc.category_id
        )
        SELECT category_id FROM sub_categories;
    `;
    
    // Execute the recursive query
    var stmt = snowflake.createStatement({sqlText: sql, binds: [CATEGORY_ID]});
    var result = stmt.execute();
    
    // Delete each subcategory
    while (result.next()) {
        var subCategoryId = result.getColumnValue(1);
        var deleteStmt = snowflake.createStatement({sqlText: `DELETE FROM category WHERE category_id = ?`, binds: [subCategoryId]});
        deleteStmt.execute();
    }
    
    return "Subcategories deleted successfully.";
} catch (err) {
    return "Error: " + err.message;
}
$$;

INSERT INTO EVERSHOP_copy.PUBLIC.CATEGORY (CATEGORY_ID, PARENT_ID, STATUS, INCLUDE_IN_NAV)
VALUES
  (8, NULL, TRUE, TRUE),    -- Root category with no parent
  (9, 8, TRUE, TRUE),       -- Subcategory with parent category_id 8
  (10, 9, TRUE, TRUE),      -- Subcategory with parent category_id 9
  (11, 10, TRUE, TRUE);     -- Subcategory with parent category_id 10



CALL delete_sub_categories ('9');


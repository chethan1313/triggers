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



CREATE OR REPLACE PROCEDURE build_url_key(
    DATA_JSON VARIANT,  -- JSON with column values (must include NAME if URL_KEY is null/empty)
    whereClause STRING  -- WHERE clause (NULL for INSERT)
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // Begin transaction.
    snowflake.execute({ sqlText: `BEGIN TRANSACTION` });
    
    // Convert the input JSON to a JavaScript object.
    const data = DATA_JSON;
    const whereClauseStr = (whereClause && whereClause.trim() !== "") ? whereClause : null;
    
    // Mimic the trigger logic:
    // If URL_KEY is null or empty, generate it from NAME.
    if (!data.hasOwnProperty("URL_KEY") ||
        data.URL_KEY === null ||
        (typeof data.URL_KEY === 'string' && data.URL_KEY.trim() === '')) {
        
        // Require NAME to generate URL_KEY.
        if (!data.hasOwnProperty("NAME") || data.NAME === null) {
            throw new Error("Missing required field: NAME");
        }
        let name = data.NAME;
        // Replace non-alphanumeric characters with a hyphen.
        let urlKey = name.replace(/[^a-zA-Z0-9]+/g, '-');
        // Remove leading/trailing hyphens.
        urlKey = urlKey.replace(/^-|-$/g, '');
        // Convert to lowercase.
        urlKey = urlKey.toLowerCase();
        // Append a hyphen and a random number.
        const randomSuffix = Math.floor(Math.random() * 1000000);
        urlKey = `${urlKey}-${randomSuffix}`;
        data.URL_KEY = urlKey;
    } else {
        // If URL_KEY is provided, validate that it doesn't contain '/', '\' or '#'.
        if (/[\/\\#]/.test(data.URL_KEY)) {
            throw new Error("Invalid url_key: " + data.URL_KEY);
        }
    }
    
    // Build the dynamic SQL query.
    let query = "";
    if (!whereClauseStr) {
        // Build an INSERT query.
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
                values.push(val ? 'TRUE' : 'FALSE');
            } else if (val === null) {
                values.push("NULL");
            } else {
                values.push(val.toString());
            }
        }
        query = `
            INSERT INTO CATEGORY_DESCRIPTION (${columns.join(", ")})
            VALUES (${values.join(", ")})
        `;
    } else {
        // Build an UPDATE query.
        let setClauses = [];
        for (let key in data) {
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
        query = `
            UPDATE CATEGORY_DESCRIPTION
            SET ${setClauses.join(", ")}
            WHERE ${whereClauseStr}
        `;
    }
    
    // Execute the dynamic SQL query.
    const stmt = snowflake.createStatement({ sqlText: query });
    stmt.execute();
    
    // Retrieve the affected row.
    let selectSQL = "";
    if (!whereClauseStr) {
        // For insert, assume the primary key is auto-generated; select the latest inserted row.
        selectSQL = `
            SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
            FROM CATEGORY_DESCRIPTION
            ORDER BY CATEGORY_DESCRIPTION_ID DESC
            LIMIT 1
        `;
    } else {
        // For update, select the row matching the where clause.
        selectSQL = `
            SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
            FROM CATEGORY_DESCRIPTION
            WHERE ${whereClauseStr}
            LIMIT 1
        `;
    }
    const stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    const resultSelect = stmtSelect.execute();
    if (!resultSelect.next()) {
        throw new Error("No category description found after upsert.");
    }
    const row = resultSelect.getColumnValue("row_data");
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    return row;
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error("Error: " + err);
}
$$;


CALL build_url_key(
  PARSE_JSON('{
    "CATEGORY_DESCRIPTION_CATEGORY_ID": 201,
    "NAME": "New Category Description111111",
    "SHORT_DESCRIPTION": "A short description",
    "META_DESCRIPTION": "LLLLLLLLLLLL",
    "URL_KEY": null
  }'),
  NULL
);


CALL build_url_key(
  PARSE_JSON('{
    "NAME": "Updated Category Description",
    "SHORT_DESCRIPTION": "Updated short description",
    "META_TITLE": "kk"
  }'),
  'CATEGORY_DESCRIPTION_ID = 1108'
);



+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

 CREATE OR REPLACE PROCEDURE build_url_key(
    DATA_JSON VARIANT,  -- JSON with column values (for insert, must include NAME and PRODUCT_DESCRIPTION_PRODUCT_ID)
    whereClause STRING  -- WHERE clause (NULL for INSERT)
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // Begin transaction.
    snowflake.execute({ sqlText: `BEGIN TRANSACTION` });
    
    const data = DATA_JSON;
    const whereClauseStr = (whereClause && whereClause.trim() !== "") ? whereClause : null;
    
    if (!whereClauseStr) {
        // INSERT operation: require NAME and PRODUCT_DESCRIPTION_PRODUCT_ID.
        if (!data.hasOwnProperty("NAME") || data.NAME === null) {
            throw new Error("Missing required field: NAME");
        }
        if (!data.hasOwnProperty("PRODUCT_DESCRIPTION_PRODUCT_ID") || data.PRODUCT_DESCRIPTION_PRODUCT_ID === null) {
            throw new Error("Missing required field: PRODUCT_DESCRIPTION_PRODUCT_ID");
        }
        // For new rows: if URL_KEY is missing or empty, generate one from NAME.
        if (!data.hasOwnProperty("URL_KEY") ||
            data.URL_KEY === null ||
            (typeof data.URL_KEY === 'string' && data.URL_KEY.trim() === '')) {
            let name = data.NAME;
            let urlKey = name.replace(/[^a-zA-Z0-9]+/g, '-')
                             .replace(/^-|-$/g, '')
                             .toLowerCase();
            const randomSuffix = Math.floor(Math.random() * 1000000);
            urlKey = `${urlKey}-${randomSuffix}`;
            data.URL_KEY = urlKey;
        }
    } else {
        // UPDATE operation: fields are optional.
        // If NAME is provided and URL_KEY is missing or empty, generate a new URL_KEY.
        if (data.hasOwnProperty("NAME") &&
            data.NAME &&
            (!data.hasOwnProperty("URL_KEY") ||
             data.URL_KEY === null ||
             (typeof data.URL_KEY === 'string' && data.URL_KEY.trim() === ''))) {
            let name = data.NAME;
            let urlKey = name.replace(/[^a-zA-Z0-9]+/g, '-')
                             .replace(/^-|-$/g, '')
                             .toLowerCase();
            const randomSuffix = Math.floor(Math.random() * 1000000);
            urlKey = `${urlKey}-${randomSuffix}`;
            data.URL_KEY = urlKey;
        } else if (
            data.hasOwnProperty("URL_KEY") &&
            typeof data.URL_KEY === 'string' &&
            data.URL_KEY.trim() !== ''
        ) {
            // If URL_KEY is provided (non-empty), validate that it doesn't contain '/', '\' or '#'.
            if (/[\/\\#]/.test(data.URL_KEY)) {
                throw new Error("Invalid url_key: " + data.URL_KEY);
            }
        }
    }
    
    // Build the dynamic SQL query.
    let query = "";
    if (!whereClauseStr) {
        // Build an INSERT query.
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
        query = `
            INSERT INTO PRODUCT_DESCRIPTION (${columns.join(", ")})
            VALUES (${values.join(", ")})
        `;
    } else {
        // Build an UPDATE query.
        let setClauses = [];
        for (let key in data) {
            let val = data[key];
            if (typeof val === 'string') {
                val = val.replace(/'/g, "''");
                setClauses.push(`${key} = '${val}'`);
            } else if (typeof val === 'boolean') {
                setClauses.push(`${key} = ${val ? "TRUE" : "FALSE"}`);
            } else if (val === null) {
                setClauses.push(`${key} = NULL`);
            } else {
                setClauses.push(`${key} = ${val}`);
            }
        }
        query = `
            UPDATE PRODUCT_DESCRIPTION
            SET ${setClauses.join(", ")}
            WHERE ${whereClauseStr}
        `;
    }
    
    // Execute the dynamic SQL query.
    const stmt = snowflake.createStatement({ sqlText: query });
    stmt.execute();
    
    // Retrieve the affected row.
    let selectSQL = "";
    if (!whereClauseStr) {
        // For INSERT, assume the row with the highest PRODUCT_DESCRIPTION_ID is the newly inserted one.
        selectSQL = `
            SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
            FROM PRODUCT_DESCRIPTION
            ORDER BY PRODUCT_DESCRIPTION_ID DESC
            LIMIT 1
        `;
    } else {
        // For UPDATE, select the row matching the WHERE clause.
        selectSQL = `
            SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
            FROM PRODUCT_DESCRIPTION
            WHERE ${whereClauseStr}
            LIMIT 1
        `;
    }
    const stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    const resultSelect = stmtSelect.execute();
    if (!resultSelect.next()) {
        throw new Error("No product description found after upsert.");
    }
    const row = resultSelect.getColumnValue("row_data");
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    return row;
} catch (err) {
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error("Error: " + err);
}
$$;


CALL build_url_key(
  PARSE_JSON('{
    "PRODUCT_DESCRIPTION_PRODUCT_ID": 500,
    "NAME": "New Product Description",
    "DESCRIPTION": "Detailed description here",
    "SHORT_DESCRIPTION": "Short desc",
    "URL_KEY": ""
  }'),
  NULL
);

CALL build_url_key(
  PARSE_JSON('{
    "NAME": "Updated Product Description",
    "DESCRIPTION": "Updated detailed description",
    "URL_KEY": ""
  }'),
  'PRODUCT_DESCRIPTION_ID = 123'
);





line-229-257*******************************************************************************************************************

C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\api\deleteCategory\deleteCategory.js
11
14

CREATE OR REPLACE PROCEDURE DELETE_CATEGORY_AND_SUBCATEGORIES(
    whereClause STRING  -- WHERE clause, e.g. "CATEGORY_ID = 6"
)
RETURNS STRING
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
    
    // Extract the parent category ID from the WHERE clause.
    // Assumes the format "CATEGORY_ID = <number>"
    const regex = /CATEGORY_ID\s*=\s*(\d+)/i;
    const match = whereClause.match(regex);
    if (!match) {
        throw new Error("Invalid WHERE clause. Could not extract CATEGORY_ID.");
    }
    const parentId = match[1];
    
    // Build a recursive query to get all sub-category IDs.
    const cteQuery = `
        WITH sub_categories AS (
            SELECT category_id 
            FROM CATEGORY 
            WHERE parent_id = ${parentId}
            UNION ALL
            SELECT c.category_id 
            FROM CATEGORY c
            INNER JOIN sub_categories sc ON c.parent_id = sc.category_id
        )
        SELECT category_id FROM sub_categories
    `;
    const stmtCTE = snowflake.createStatement({ sqlText: cteQuery });
    const result = stmtCTE.execute();
    let ids = [];
    while (result.next()) {
        ids.push(result.getColumnValue(1));
    }
    
    // If any sub-category IDs were found, delete them.
    if (ids.length > 0) {
        const idList = ids.join(", ");
        const deleteSubQuery = `
            DELETE FROM CATEGORY
            WHERE category_id IN (${idList})
        `;
        const stmtDeleteSub = snowflake.createStatement({ sqlText: deleteSubQuery });
        stmtDeleteSub.execute();
    }
    
    // Delete the parent category.
    const deleteParentQuery = `
        DELETE FROM CATEGORY
        WHERE category_id = ${parentId}
    `;
    const stmtDeleteParent = snowflake.createStatement({ sqlText: deleteParentQuery });
    stmtDeleteParent.execute();
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    return "Success: Parent category and its subcategories deleted";
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error("Error: " + err);
}
$$;



CALL DELETE_CATEGORY_AND_SUBCATEGORIES('CATEGORY_ID = 6');


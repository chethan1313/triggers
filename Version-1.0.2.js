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



CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.GENERATE_URL_KEYS()
RETURNS STRING
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
    try {
        // Function to generate a clean URL key
        function buildUrlKey(name) {
            if (!name) {
                return null;
            }

            // Replace non-alphanumeric characters with "-"
            let url_key = name.replace(/[^a-zA-Z0-9]+/g, '-');

            // Remove leading and trailing "-"
            url_key = url_key.replace(/^-+|-+$/g, '');

            // Convert to lowercase
            url_key = url_key.toLowerCase();

            // Append random number to ensure uniqueness
            url_key = url_key + '-' + Math.floor(Math.random() * 1000000);

            return url_key;
        }

        // Update URL_KEY for CATEGORY_DESCRIPTION where it is 'TEMP_URL_KEY'
        var sql_command1 = `
            UPDATE EVERSHOP_COPY.PUBLIC.CATEGORY_DESCRIPTION
            SET URL_KEY = 
                LOWER(REGEXP_REPLACE(NAME, '[^a-zA-Z0-9]+', '-')) || '-' || CAST(FLOOR(RANDOM() * 1000000) AS STRING)
            WHERE URL_KEY = 'TEMP_URL_KEY' 
            AND NAME IS NOT NULL
            AND NOT REGEXP_LIKE(URL_KEY, '[/\\\\#]');
        `;
        snowflake.execute({sqlText: sql_command1});

        // Update URL_KEY for PRODUCT_DESCRIPTION where it is 'TEMP_URL_KEY'
        var sql_command2 = `
            UPDATE EVERSHOP_COPY.PUBLIC.PRODUCT_DESCRIPTION
            SET URL_KEY = 
                LOWER(REGEXP_REPLACE(NAME, '[^a-zA-Z0-9]+', '-')) || '-' || CAST(FLOOR(RANDOM() * 1000000) AS STRING)
            WHERE URL_KEY = 'TEMP_URL_KEY' 
            AND NAME IS NOT NULL
            AND NOT REGEXP_LIKE(URL_KEY, '[/\\\\#]');
        `;
        snowflake.execute({sqlText: sql_command2});

        return 'URL keys generated successfully!';
    } catch (err) {
        return 'Error generating URL keys: ' + err.message;
    }
$$;


$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$4

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.GENERATE_URL_KEYS()
RETURNS STRING
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
    try {
        // Function to generate a clean URL key
        function buildUrlKey(name) {
            if (!name) {
                return null;
            }

            // Replace non-alphanumeric characters with "-"
            let url_key = name.replace(/[^a-zA-Z0-9]+/g, '-');

            // Remove leading and trailing "-"
            url_key = url_key.replace(/^-+|-+$/g, '');

            // Convert to lowercase
            url_key = url_key.toLowerCase();

            // Append random number to ensure uniqueness
            url_key = url_key + '-' + Math.floor(Math.random() * 1000000);

            return url_key;
        }

        // Update URL_KEY for CATEGORY_DESCRIPTION where it has the temp URL_KEY
        var sql_command1 = `
            UPDATE EVERSHOP_COPY.PUBLIC.CATEGORY_DESCRIPTION
            SET URL_KEY = 
                LOWER(REGEXP_REPLACE(NAME, '[^a-zA-Z0-9]+', '-')) || '-' || CAST(FLOOR(RANDOM() * 1000000) AS STRING)
            WHERE URL_KEY IS NULL 
            AND NAME IS NOT NULL
            AND NOT REGEXP_LIKE(URL_KEY, '[/\\\\#]');
        `;
        snowflake.execute({sqlText: sql_command1});

        // Update URL_KEY for PRODUCT_DESCRIPTION where it has the temp URL_KEY
        var sql_command2 = `
            UPDATE EVERSHOP_COPY.PUBLIC.PRODUCT_DESCRIPTION
            SET URL_KEY = 
                LOWER(REGEXP_REPLACE(NAME, '[^a-zA-Z0-9]+', '-')) || '-' || CAST(FLOOR(RANDOM() * 1000000) AS STRING)
            WHERE URL_KEY IS NULL 
            AND NAME IS NOT NULL
            AND NOT REGEXP_LIKE(URL_KEY, '[/\\\\#]');
        `;
        snowflake.execute({sqlText: sql_command2});

        return 'URL keys generated successfully!';
    } catch (err) {
        return 'Error generating URL keys: ' + err.message;
    }
$$;




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


file=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.2.js

  line=26-65

CREATE OR REPLACE FUNCTION EVERSHOP_COPY.PUBLIC.GENERATE_URL_KEY(name STRING)
RETURNS STRING
LANGUAGE JAVASCRIPT
AS
$$
try {
    var input_name = arguments[0]; // Use arguments[0] to access the function parameter

    if (!input_name) {
        throw new Error("Name cannot be NULL");
    }

    // Generate a clean URL key
    let url_key = input_name.replace(/[^a-zA-Z0-9]+/g, "-");  // Replace non-alphanumeric characters
    url_key = url_key.replace(/^-+|-+$/g, "");               // Remove leading/trailing dashes
    url_key = url_key.toLowerCase();                         // Convert to lowercase
    url_key = url_key + "-" + Math.floor(Math.random() * 1000000); // Append random number

    return url_key;
} catch (err) {
    return "ERROR: " + err.message;  // Return the actual error message
}
$$;





CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.UPDATE_URL_KEY(table_name STRING)
RETURNS STRING
LANGUAGE JAVASCRIPT
AS
$$
try {
    // Construct the dynamic SQL query string
    var sql_command = "UPDATE " + table_name + " " +
                      "SET URL_KEY = LOWER(REGEXP_REPLACE(NAME, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || CAST(UNIFORM(100000, 999999, RANDOM()) AS STRING) " +
                      "WHERE URL_KEY IS NULL AND NAME IS NOT NULL;";

    // Execute the dynamic SQL
    var stmt = snowflake.createStatement({sqlText: sql_command});
    stmt.execute();

    return 'URL keys updated successfully';
} catch (err) {
    return 'Error: ' + err.message;
}
$$;



-- Insert into PRODUCT_DESCRIPTION
SET url_key_value = (SELECT EVERSHOP_COPY.PUBLIC.GENERATE_URL_KEY('Smartphone - Model X'));
INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT_DESCRIPTION 
(PRODUCT_DESCRIPTION_PRODUCT_ID, NAME, DESCRIPTION, SHORT_DESCRIPTION, META_TITLE, META_DESCRIPTION, META_KEYWORDS, URL_KEY)
VALUES
(101, 'Smartphone - Model X', 'Latest smartphone', 'Best smartphone of 2025', 'Smartphone X', 'Fastest phone', 'smartphone, mobile', 
$url_key_value);

-- update into PRODUCT_DESCRIPTION
SET url_key_value = (SELECT EVERSHOP_COPY.PUBLIC.GENERATE_URL_KEY('Smartphone - Model X'));
UPDATE EVERSHOP_COPY.PUBLIC.PRODUCT_DESCRIPTION
SET URL_KEY = $url_key_value
WHERE PRODUCT_DESCRIPTION_PRODUCT_ID = 101;

-- Insert into CATEGORY_DESCRIPTION
SET url_key_value = (SELECT EVERSHOP_COPY.PUBLIC.GENERATE_URL_KEY('Smartphone - Category'));
INSERT INTO EVERSHOP_COPY.PUBLIC.CATEGORY_DESCRIPTION 
(CATEGORY_DESCRIPTION_CATEGORY_ID, NAME, SHORT_DESCRIPTION, DESCRIPTION, IMAGE, META_TITLE, META_DESCRIPTION, META_KEYWORDS, URL_KEY)
VALUES
(1001, 'Smartphone - Category', 'Best smartphones available', 'A category for the best smartphones of 2025', 'image_url_here', 'Smartphone Category', 'Explore top smartphones', 'smartphone, mobile', $url_key_value);

-- UPDATE into CATEGORY_DESCRIPTION
SET url_key_value = (SELECT EVERSHOP_COPY.PUBLIC.GENERATE_URL_KEY('Smartphone - Category'));
UPDATE EVERSHOP_COPY.PUBLIC.CATEGORY_DESCRIPTION
SET URL_KEY = $url_key_value
WHERE CATEGORY_DESCRIPTION_CATEGORY_ID = 1001;


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


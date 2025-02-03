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



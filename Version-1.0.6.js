filename=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.6.js

line=26-44

C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.6.js
60
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\product\createProduct.js
154
C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\services\product\updateProduct.js
239

CREATE OR REPLACE PROCEDURE INSERT_PRODUCT_IMAGE_WITH_EVENT(
    DATA_JSON VARIANT  -- JSON with key-value pairs for fields to insert into PRODUCT_IMAGE
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
    let columns = [];
    let values = [];
    
    // --- 1. Build the dynamic INSERT statement for PRODUCT_IMAGE ---
    for (const key in data) {
        columns.push(key);
        let val = data[key];
        if (typeof val === 'string') {
            // Escape any single quotes in string values.
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
    
    const insertSQL = `
        INSERT INTO PRODUCT_IMAGE (${columns.join(", ")})
        VALUES (${values.join(", ")})
    `;
    const stmtInsert = snowflake.createStatement({ sqlText: insertSQL });
    stmtInsert.execute();
    
    // --- 2. Retrieve the newly inserted PRODUCT_IMAGE row using OBJECT_CONSTRUCT_KEEP_NULL(*) ---
    // Ensure that the input JSON contains PRODUCT_IMAGE_PRODUCT_ID for retrieval.
    if (!data.hasOwnProperty("PRODUCT_IMAGE_PRODUCT_ID")) {
        throw new Error("Input JSON must include PRODUCT_IMAGE_PRODUCT_ID for retrieval.");
    }
    const prodId = data.PRODUCT_IMAGE_PRODUCT_ID;
    const selectSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM PRODUCT_IMAGE
        WHERE PRODUCT_IMAGE_PRODUCT_ID = ${prodId}
        ORDER BY PRODUCT_IMAGE_ID DESC
        LIMIT 1
    `;
    const stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    const resultSelect = stmtSelect.execute();
    if (!resultSelect.next()) {
        throw new Error("No inserted row found.");
    }
    const insertedRow = resultSelect.getColumnValue("row_data");
    
    // --- 3. Log an event in the EVENT table ---
    let eventDataStr = JSON.stringify(insertedRow).replace(/'/g, "''");
    const eventSQL = `
        INSERT INTO EVENT (NAME, DATA)
        SELECT 'product_image_added', PARSE_JSON('${eventDataStr}')
    `;
    const stmtEvent = snowflake.createStatement({ sqlText: eventSQL });
    stmtEvent.execute();
    
    // Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // --- 4. Return the inserted row as a VARIANT ---
    return insertedRow;
    
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error("Error: " + err);
}
$$;


CALL INSERT_PRODUCT_IMAGE_WITH_EVENT(
    PARSE_JSON('{
        "PRODUCT_IMAGE_PRODUCT_ID": 101,
        "ORIGIN_IMAGE": "origin.jpg",
        "THUMB_IMAGE": "thumb.jpg",
        "LISTING_IMAGE": "listing.jpg",
        "SINGLE_IMAGE": "single.jpg",
        "IS_MAIN": false
    }')
);

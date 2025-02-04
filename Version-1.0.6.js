filename=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\catalog\migration\Version-1.0.6.js

line=26-44

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.INSERT_PRODUCT_IMAGE(
    PRODUCT_IMAGE_PRODUCT_ID FLOAT, -- Use FLOAT instead of NUMBER(38,0)
    ORIGIN_IMAGE VARCHAR,
    THUMB_IMAGE VARCHAR,
    LISTING_IMAGE VARCHAR,
    SINGLE_IMAGE VARCHAR,
    IS_MAIN BOOLEAN
)
RETURNS STRING
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS $$
try {
    // Start transaction
    snowflake.execute({ sqlText: `BEGIN TRANSACTION;` });

    // 1. Insert into PRODUCT_IMAGE without using RETURNING clause
    var insertStmt = snowflake.createStatement({
        sqlText: `
            INSERT INTO EVERSHOP_COPY.PUBLIC.PRODUCT_IMAGE (
                PRODUCT_IMAGE_PRODUCT_ID, ORIGIN_IMAGE, THUMB_IMAGE, 
                LISTING_IMAGE, SINGLE_IMAGE, IS_MAIN
            )
            VALUES (?, ?, ?, ?, ?, ?);`,
        binds: [
            PRODUCT_IMAGE_PRODUCT_ID, ORIGIN_IMAGE, THUMB_IMAGE, 
            LISTING_IMAGE, SINGLE_IMAGE, IS_MAIN
        ]
    });
    insertStmt.execute();

    // 2. Fetch the newly inserted row using SELECT statement
    var fetchStmt = snowflake.createStatement({
        sqlText: `
            SELECT * FROM EVERSHOP_COPY.PUBLIC.PRODUCT_IMAGE 
            WHERE PRODUCT_IMAGE_PRODUCT_ID = ? 
            ORDER BY PRODUCT_IMAGE_ID DESC LIMIT 1;`,
        binds: [PRODUCT_IMAGE_PRODUCT_ID]
    });
    var fetchResult = fetchStmt.execute();
    fetchResult.next();

    // 3. Build new data JSON from inserted row
    var newData = {};
    for (var col = 1; col <= fetchResult.getColumnCount(); col++) {
        var colName = fetchResult.getColumnName(col);
        var colValue = fetchResult.getColumnValue(col);
        // Convert NUMBER(38,0) to FLOAT for JavaScript compatibility
        if (typeof colValue === 'object' && colValue !== null && colValue.constructor.name === 'BigNumber') {
            colValue = colValue.toNumber(); // Convert BigNumber to JavaScript number
        }
        newData[colName] = colValue;
    }
    var newDataJson = JSON.stringify(newData);

    // 4. Insert into EVENT table to log the action
    var eventStmt = snowflake.createStatement({
        sqlText: `
            INSERT INTO EVERSHOP_COPY.PUBLIC.EVENT (NAME, DATA)
            SELECT 'product_image_added', PARSE_JSON(?);`,
        binds: [newDataJson]
    });
    eventStmt.execute();

    // Commit transaction
    snowflake.execute({ sqlText: `COMMIT;` });

    return "Insert successful with event logged.";
} catch (err) {
    // Rollback on error
    snowflake.execute({ sqlText: `ROLLBACK;` });
    return "Error: " + err;
}
$$;



CALL EVERSHOP_COPY.PUBLIC.INSERT_PRODUCT_IMAGE(
    123, -- PRODUCT_IMAGE_PRODUCT_ID
    'https://example.com/origin.jpg', -- ORIGIN_IMAGE
    'https://example.com/thumb.jpg', -- THUMB_IMAGE
    'https://example.com/listing.jpg', -- LISTING_IMAGE
    'https://example.com/single.jpg', -- SINGLE_IMAGE
    TRUE -- IS_MAIN
);

filename=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\promotion\migration\Version-1.0.0.js

line=34-53

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.INSERT_ORDER_AND_UPDATE_COUPON(
    DATA_JSON VARIANT  -- JSON with key-value pairs for fields to insert into SALES_ORDER
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // --- 1. Build the dynamic INSERT statement for SALES_ORDER ---
    var data = DATA_JSON;
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
            values.push(val ? "TRUE" : "FALSE");
        } else if (val === null) {
            values.push("NULL");
        } else {
            values.push(val.toString());
        }
    }
    
    var insertSQL = "INSERT INTO EVERSHOP_COPY.PUBLIC.SALES_ORDER (" 
                    + columns.join(", ") 
                    + ") VALUES (" 
                    + values.join(", ") 
                    + ")";
                    
    var stmtInsert = snowflake.createStatement({ sqlText: insertSQL });
    stmtInsert.execute();
    
    // --- 2. Retrieve the newly inserted order row ---
    // (Assuming no concurrent inserts; select the row with the highest ORDER_ID)
    var selectSQL = "SELECT * FROM EVERSHOP_COPY.PUBLIC.SALES_ORDER ORDER BY ORDER_ID DESC LIMIT 1";
    var stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    var result = stmtSelect.execute();
    if (!result.next()) {
        throw "No inserted order found.";
    }
    var insertedRow = {};
    var colCount = result.getColumnCount();
    for (var i = 1; i <= colCount; i++) {
        var colName = result.getColumnName(i);
        insertedRow[colName] = result.getColumnValue(i);
    }
    
    // --- 3. Update the coupon's USED_TIME if a coupon is provided ---
    if (insertedRow["COUPON"] != null && insertedRow["COUPON"].toString().trim() !== "") {
        var couponCode = insertedRow["COUPON"].toString().trim();
        var updateCouponSQL = "UPDATE EVERSHOP_COPY.PUBLIC.COUPON SET USED_TIME = USED_TIME + 1 WHERE COUPON = '" 
                              + couponCode.replace(/'/g, "''") + "'";
        var stmtCoupon = snowflake.createStatement({ sqlText: updateCouponSQL });
        stmtCoupon.execute();
        var affectedRows = stmtCoupon.getRowCount();
        // Optional: if no coupon row was updated, you might want to log a warning.
        if (affectedRows === 0) {
            // For now, we'll add a message to the returned object.
            insertedRow["coupon_update_message"] = "No coupon row updated. Check coupon code: " + couponCode;
        }
    }
    
    // --- 4. Return the inserted order row as a VARIANT ---
    return JSON.parse(JSON.stringify(insertedRow));
    
} catch (err) {
    return "Error: " + err;
}
$$;


INSERT INTO EVERSHOP_COPY.PUBLIC.COUPON (
    DESCRIPTION, 
    DISCOUNT_AMOUNT, 
    FREE_SHIPPING, 
    DISCOUNT_TYPE, 
    COUPON, 
    USED_TIME, 
    MAX_USES_TIME_PER_COUPON, 
    MAX_USES_TIME_PER_CUSTOMER, 
    START_DATE, 
    END_DATE, 
    TARGET_PRODUCTS, 
    CONDITION, 
    USER_CONDITION, 
    BUYX_GETY
)
VALUES (
    '10% off on all items', 10.00, FALSE, '1', 'SAVE10', 0, 100, 1,
    CURRENT_TIMESTAMP(), DATEADD(month, 1, CURRENT_TIMESTAMP()),
    NULL, NULL, NULL, NULL
);


CALL EVERSHOP_COPY.PUBLIC.INSERT_ORDER_AND_UPDATE_COUPON(
    PARSE_JSON('{
        "ORDER_NUMBER": "SO-1002",
        "STATUS": "pending",
        "CART_ID": 300,
        "CURRENCY": "USD",
        "CUSTOMER_ID": 55,
        "SUB_TOTAL": 200.00,
        "SUB_TOTAL_INCL_TAX": 220.00,
        "SUB_TOTAL_WITH_DISCOUNT": 200.00,
        "SUB_TOTAL_WITH_DISCOUNT_INCL_TAX": 220.00,
        "TOTAL_QTY": 2,
        "TAX_AMOUNT": 20.00,
        "TAX_AMOUNT_BEFORE_DISCOUNT": 20.00,
        "SHIPPING_TAX_AMOUNT": 5.00,
        "GRAND_TOTAL": 225.00,
        "COUPON": "SAVE10"
    }')
);

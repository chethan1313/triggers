filename=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\promotion\migration\Version-1.0.0.js
  
line=34-53

C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\checkout\services\orderCreator.js
150


CREATE OR REPLACE PROCEDURE INSERT_ORDER_AND_UPDATE_COUPON(
    DATA_JSON VARIANT  -- JSON with key-value pairs for fields to insert into SALES_ORDER
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
    
    // --- 1. Build the dynamic INSERT statement for SALES_ORDER ---
    for (const key in data) {
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
    
    const insertSQL = `
        INSERT INTO SALES_ORDER (${columns.join(", ")})
        VALUES (${values.join(", ")})
    `;
    const stmtInsert = snowflake.createStatement({ sqlText: insertSQL });
    stmtInsert.execute();
    
    // --- 2. Retrieve the newly inserted order row using OBJECT_CONSTRUCT_KEEP_NULL(*) ---
    // (Assumes no concurrent inserts; selects the row with the highest ORDER_ID)
    const selectSQL = `
        SELECT OBJECT_CONSTRUCT_KEEP_NULL(*) AS row_data
        FROM SALES_ORDER
        ORDER BY ORDER_ID DESC
        LIMIT 1
    `;
    const stmtSelect = snowflake.createStatement({ sqlText: selectSQL });
    const result = stmtSelect.execute();
    if (!result.next()) {
        throw new Error("No inserted order found.");
    }
    const insertedRow = result.getColumnValue("row_data");
    
    // --- 3. Update the coupon's USED_TIME if a coupon is provided ---
    if (insertedRow["COUPON"] != null && insertedRow["COUPON"].toString().trim() !== "") {
        const couponCode = insertedRow["COUPON"].toString().trim();
        const updateCouponSQL = `
            UPDATE COUPON
            SET USED_TIME = USED_TIME + 1
            WHERE COUPON = '${couponCode.replace(/'/g, "''")}'
        `;
        const stmtCoupon = snowflake.createStatement({ sqlText: updateCouponSQL });
        stmtCoupon.execute();
        const affectedRows = stmtCoupon.getRowCount();
        // If no coupon row was updated, add a message to the insertedRow object.
        if (affectedRows === 0) {
            insertedRow["coupon_update_message"] = `No coupon row updated. Check coupon code: ${couponCode}`;
        }
    }
    
    // --- 4. Commit the transaction.
    snowflake.execute({ sqlText: `COMMIT` });
    
    // --- 5. Return the inserted order row as a VARIANT.
    return insertedRow;
    
} catch (err) {
    // Rollback if any error occurs.
    snowflake.execute({ sqlText: `ROLLBACK` });
    throw new Error(`Procedure INSERT_ORDER_AND_UPDATE_COUPON failed: ${err.message || err}`);
}
$$;


CALL set_coupon_used_time(
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

filename=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\promotion\migration\Version-1.0.0.js

line=34-53

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.UPDATE_COUPON_USED_TIME(order_coupon STRING)
RETURNS STRING
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    // Retrieve input parameter correctly
    var couponCode = ORDER_COUPON;

    // Check if the coupon exists
    var sql_check = `SELECT COUNT(*) FROM EVERSHOP_COPY.PUBLIC.COUPON WHERE COUPON = ?`;
    var stmt_check = snowflake.createStatement({sqlText: sql_check, binds: [couponCode]});
    var result_check = stmt_check.execute();
    
    result_check.next();
    var couponExists = result_check.getColumnValue(1) > 0;

    if (couponExists) {
        // Update the coupon used_time if it exists
        var sql_update = `UPDATE EVERSHOP_COPY.PUBLIC.COUPON 
                          SET USED_TIME = COALESCE(USED_TIME, 0) + 1 
                          WHERE COUPON = ?`;
        var stmt_update = snowflake.createStatement({sqlText: sql_update, binds: [couponCode]});
        stmt_update.execute();
        return "Coupon used_time updated successfully.";
    } else {
        return "Coupon not found, no update applied.";
    }
} catch (err) {
    return "Error updating coupon used_time: " + err.message;
}
$$;


INSERT INTO EVERSHOP_COPY.PUBLIC.SALES_ORDER (
    ORDER_NUMBER, STATUS, CART_ID, CURRENCY, COUPON, SUB_TOTAL, 
    SUB_TOTAL_INCL_TAX, SUB_TOTAL_WITH_DISCOUNT, SUB_TOTAL_WITH_DISCOUNT_INCL_TAX, 
    TOTAL_QTY, TAX_AMOUNT, TAX_AMOUNT_BEFORE_DISCOUNT, SHIPPING_TAX_AMOUNT, 
    GRAND_TOTAL, CREATED_AT
) VALUES (
    'ORD12345', 'Pending', 1, 'USD', 'DISCOUNT10', 100.00, 110.00, 90.00, 99.00, 
    1, 10.00, 12.00, 2.00, 100.00, CURRENT_TIMESTAMP()
);


INSERT INTO EVERSHOP_COPY.PUBLIC.COUPON (
    COUPON, DESCRIPTION, DISCOUNT_AMOUNT, USED_TIME, MAX_USES_TIME_PER_COUPON
) VALUES (
    'DISCOUNT10', '10% off', 10.00, 0, 100
);


CALL EVERSHOP_COPY.PUBLIC.UPDATE_COUPON_USED_TIME('DISCOUNT10');


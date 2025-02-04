filename=C:\Users\Chethan\Downloads\original\EverShop\node_modules\@evershop\evershop\src\modules\checkout\migration\Version-1.0.3.js

line=6-24

CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.ADD_ORDER_CREATED_EVENT(NEW_ORDER_ID NUMBER)
RETURNS STRING
LANGUAGE SQL
AS
$$
DECLARE
    NEW_ORDER VARIANT;
    ORDER_EXISTS BOOLEAN DEFAULT FALSE;
BEGIN
    -- Check if order exists (use colon for variable)
    SELECT COUNT(*) > 0 INTO :ORDER_EXISTS
    FROM EVERSHOP_COPY.PUBLIC.SALES_ORDER
    WHERE ORDER_ID = :NEW_ORDER_ID;  -- Colon added here

    IF (:ORDER_EXISTS = FALSE) THEN
        RETURN 'Error: Order not found!';
    END IF;

    -- Fetch order details (colon added)
    SELECT OBJECT_CONSTRUCT(*) INTO :NEW_ORDER
    FROM EVERSHOP_COPY.PUBLIC.SALES_ORDER
    WHERE ORDER_ID = :NEW_ORDER_ID;

    -- Insert event (colon added)
    BEGIN
        INSERT INTO EVERSHOP_COPY.PUBLIC.EVENT (NAME, DATA)
        VALUES ('order_created', :NEW_ORDER);
        
        RETURN 'Event logged successfully for Order ID: ' || :NEW_ORDER_ID::STRING;
    
    EXCEPTION 
        WHEN OTHER THEN 
            RETURN 'Error: ' || SQLERRM;
    END;
END;
$$;



CREATE OR REPLACE PROCEDURE EVERSHOP_COPY.PUBLIC.CREATE_ORDER_AND_LOG_EVENT()
RETURNS STRING
LANGUAGE SQL
AS
$$
DECLARE
    LAST_ORDER_ID NUMBER;
BEGIN
    -- Insert order
    INSERT INTO EVERSHOP_COPY.PUBLIC.SALES_ORDER (
        ORDER_NUMBER, STATUS, CART_ID, CURRENCY, SUB_TOTAL, 
        SUB_TOTAL_INCL_TAX, SUB_TOTAL_WITH_DISCOUNT, 
        SUB_TOTAL_WITH_DISCOUNT_INCL_TAX, TOTAL_QTY, TAX_AMOUNT, 
        TAX_AMOUNT_BEFORE_DISCOUNT, SHIPPING_TAX_AMOUNT, GRAND_TOTAL
    ) VALUES (
        'ORD-1002', 'NEW', 2, 'USD', 100.00, 110.00, 
        90.00, 99.00, 2, 10.00, 10.00, 5.00, 115.00
    );

    -- Get last inserted ID (alternative method)
    SELECT ORDER_ID INTO :LAST_ORDER_ID
    FROM EVERSHOP_COPY.PUBLIC.SALES_ORDER
    WHERE ORDER_NUMBER = 'ORD-1001';

    -- Call event logger
    CALL EVERSHOP_COPY.PUBLIC.ADD_ORDER_CREATED_EVENT(:LAST_ORDER_ID);

    RETURN 'Success: Order ' || :LAST_ORDER_ID || ' created and logged';
END;
$$;


-- Create the order and log the event
CALL EVERSHOP_COPY.PUBLIC.CREATE_ORDER_AND_LOG_EVENT();

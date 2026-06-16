
CREATE OR REPLACE FUNCTION update_streak(p_user_id UUID)
RETURNS void AS $func$
DECLARE
    v_current_streak INT := 0;
    v_longest_streak INT := 0;
    v_test_date DATE := CURRENT_DATE;
    v_has_log BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM habit_logs 
        WHERE user_id = p_user_id AND date = CURRENT_DATE::TEXT
    ) INTO v_has_log;
    
    IF v_has_log THEN
        v_current_streak := 1;
        v_test_date := CURRENT_DATE - INTERVAL '1 day';
    ELSE
        v_test_date := CURRENT_DATE - INTERVAL '1 day';
        SELECT EXISTS (
            SELECT 1 FROM habit_logs 
            WHERE user_id = p_user_id AND date = v_test_date::TEXT
        ) INTO v_has_log;
        IF v_has_log THEN
            v_current_streak := 1;
            v_test_date := v_test_date - INTERVAL '1 day';
        ELSE
            v_current_streak := 0;
        END IF;
    END IF;

    WHILE v_current_streak > 0 LOOP
        SELECT EXISTS (
            SELECT 1 FROM habit_logs 
            WHERE user_id = p_user_id AND date = v_test_date::TEXT
        ) INTO v_has_log;
        
        IF v_has_log THEN
            v_current_streak := v_current_streak + 1;
            v_test_date := v_test_date - INTERVAL '1 day';
        ELSE
            EXIT;
        END IF;
    END LOOP;

    UPDATE profiles 
    SET current_streak = v_current_streak,
        longest_streak = GREATEST(longest_streak, v_current_streak),
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$func$ LANGUAGE plpgsql;


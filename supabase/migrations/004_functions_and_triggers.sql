-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 004: Functions and Triggers
-- ============================================================================

-- 1. Standard Reusable Updated At Timestamp Trigger Function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Attach set_updated_at to mutable tables
DROP TRIGGER IF EXISTS trg_staff_profiles_updated_at ON public.staff_profiles;
CREATE TRIGGER trg_staff_profiles_updated_at
BEFORE UPDATE ON public.staff_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_species_updated_at ON public.species;
CREATE TRIGGER trg_species_updated_at
BEFORE UPDATE ON public.species
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_batches_updated_at ON public.inventory_batches;
CREATE TRIGGER trg_inventory_batches_updated_at
BEFORE UPDATE ON public.inventory_batches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_purchase_order_landings_updated_at ON public.purchase_order_landings;
CREATE TRIGGER trg_purchase_order_landings_updated_at
BEFORE UPDATE ON public.purchase_order_landings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_reefer_vehicles_updated_at ON public.reefer_vehicles;
CREATE TRIGGER trg_reefer_vehicles_updated_at
BEFORE UPDATE ON public.reefer_vehicles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_client_orders_updated_at ON public.client_orders;
CREATE TRIGGER trg_client_orders_updated_at
BEFORE UPDATE ON public.client_orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_fleet_vessels_updated_at ON public.fleet_vessels;
CREATE TRIGGER trg_fleet_vessels_updated_at
BEFORE UPDATE ON public.fleet_vessels
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_market_price_index_updated_at ON public.market_price_index;
CREATE TRIGGER trg_market_price_index_updated_at
BEFORE UPDATE ON public.market_price_index
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_retail_products_updated_at ON public.retail_wholesale_products;
CREATE TRIGGER trg_retail_products_updated_at
BEFORE UPDATE ON public.retail_wholesale_products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2. New Staff Profile Creation on Supabase Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_staff_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.staff_profiles (
        id,
        email,
        full_name,
        role,
        department,
        is_active
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'viewer', -- Default lowest privilege on signup; admin must elevate
        COALESCE(NEW.raw_user_meta_data->>'department', 'Operations'),
        TRUE
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_staff_signup();


-- 3. Staff Role Audit Logging Trigger
CREATE OR REPLACE FUNCTION public.audit_staff_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (OLD.role IS DISTINCT FROM NEW.role) THEN
        INSERT INTO public.staff_role_audit_logs (
            target_staff_id,
            previous_role,
            new_role,
            changed_by,
            reason
        ) VALUES (
            NEW.id,
            OLD.role,
            NEW.role,
            COALESCE(auth.uid(), NEW.id),
            'Role updated via administrative interface'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_staff_role ON public.staff_profiles;
CREATE TRIGGER trg_audit_staff_role
AFTER UPDATE ON public.staff_profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_staff_role_change();


-- 4. Hardened Immutability Trigger for the 3 Compliance Tables
CREATE OR REPLACE FUNCTION public.enforce_insert_only_compliance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'LEGAL & REGULATORY VIOLATION: Table % is strictly insert-only. Modifications and deletions are prohibited.', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_financial_ledger ON public.financial_ledger_entries;
CREATE TRIGGER trg_immutable_financial_ledger
BEFORE UPDATE OR DELETE ON public.financial_ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_only_compliance();

DROP TRIGGER IF EXISTS trg_immutable_haccp_audit ON public.haccp_audit_records;
CREATE TRIGGER trg_immutable_haccp_audit
BEFORE UPDATE OR DELETE ON public.haccp_audit_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_only_compliance();

DROP TRIGGER IF EXISTS trg_immutable_reefer_telemetry ON public.reefer_sensor_readings;
CREATE TRIGGER trg_immutable_reefer_telemetry
BEFORE UPDATE OR DELETE ON public.reefer_sensor_readings
FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_only_compliance();


-- 5. Food Safety Compliance Check Trigger on Order Line Items
-- Ensures a lot with a 'Rejected' HACCP status can never be added to an order.
CREATE OR REPLACE FUNCTION public.validate_lot_haccp_eligibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_latest_compliance public.haccp_compliance_status;
    v_inspection_status TEXT;
BEGIN
    -- Check batch inspection status
    SELECT inspection_status INTO v_inspection_status
    FROM public.inventory_batches
    WHERE id = NEW.lot_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Referenced inventory batch lot % does not exist.', NEW.lot_id;
    END IF;

    -- Query latest HACCP compliance status for this lot
    SELECT final_compliance INTO v_latest_compliance
    FROM public.haccp_audit_records
    WHERE lot_id = NEW.lot_id
    ORDER BY inspection_date DESC
    LIMIT 1;

    IF v_latest_compliance = 'Rejected' THEN
        RAISE EXCEPTION 'FOOD SAFETY AUDIT EXCEPTION: Lot % has been REJECTED by HACCP inspection and cannot be sold or allocated.', NEW.lot_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_item_haccp ON public.order_line_items;
CREATE TRIGGER trg_validate_order_item_haccp
BEFORE INSERT OR UPDATE ON public.order_line_items
FOR EACH ROW EXECUTE FUNCTION public.validate_lot_haccp_eligibility();


-- 6. State Machine Trigger for Client Order Status Progression
-- Rule: Pending Confirmation → Weighing & Grading → Cryo-Packed & Iced → In Reefer Transit → Delivered.
-- May transition to 'Cancelled' from any non-terminal state.
-- Terminal states ('Delivered' and 'Cancelled') are irreversible.
CREATE OR REPLACE FUNCTION public.enforce_order_status_progression()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_old_rank INT;
    v_new_rank INT;
BEGIN
    IF (OLD.status = NEW.status) THEN
        RETURN NEW;
    END IF;

    -- Cannot leave terminal states
    IF OLD.status IN ('Delivered', 'Cancelled') THEN
        RAISE EXCEPTION 'INVALID STATE TRANSITION: Order % is already in terminal state % and cannot be modified.',
            OLD.id, OLD.status;
    END IF;

    -- Any non-terminal state may transition to Cancelled
    IF NEW.status = 'Cancelled' THEN
        RETURN NEW;
    END IF;

    -- Map sequential progression ranks
    v_old_rank := CASE OLD.status
        WHEN 'Pending Confirmation' THEN 1
        WHEN 'Weighing & Grading'    THEN 2
        WHEN 'Cryo-Packed & Iced'    THEN 3
        WHEN 'In Reefer Transit'     THEN 4
        ELSE 0
    END;

    v_new_rank := CASE NEW.status
        WHEN 'Pending Confirmation' THEN 1
        WHEN 'Weighing & Grading'    THEN 2
        WHEN 'Cryo-Packed & Iced'    THEN 3
        WHEN 'In Reefer Transit'     THEN 4
        WHEN 'Delivered'             THEN 5
        ELSE 0
    END;

    -- Enforce forward-only progression
    IF v_new_rank < v_old_rank THEN
        RAISE EXCEPTION 'INVALID STATE TRANSITION: Order % cannot move backward from "%" to "%".',
            OLD.id, OLD.status, NEW.status;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_status ON public.client_orders;
CREATE TRIGGER trg_enforce_order_status
BEFORE UPDATE OF status ON public.client_orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_status_progression();


-- 7. Automated Cold-Chain Excursion Notification Trigger
CREATE OR REPLACE FUNCTION public.check_reefer_telemetry_excursion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vehicle RECORD;
BEGIN
    SELECT name, min_safe_temp, max_safe_temp INTO v_vehicle
    FROM public.reefer_vehicles
    WHERE id = NEW.vehicle_id;

    IF FOUND THEN
        -- Update vehicle current temperature
        UPDATE public.reefer_vehicles
        SET current_temp_celsius = NEW.temperature,
            ambient_humidity_pct = NEW.humidity,
            status = CASE 
                WHEN (NEW.temperature < v_vehicle.min_safe_temp OR NEW.temperature > v_vehicle.max_safe_temp)
                THEN 'Temp Alert!'
                ELSE status
            END,
            updated_at = now()
        WHERE id = NEW.vehicle_id;

        -- If temperature excursion detected, push system notification
        IF (NEW.temperature > v_vehicle.max_safe_temp) THEN
            INSERT INTO public.system_notifications (
                type,
                title,
                message,
                urgency,
                related_entity_id
            ) VALUES (
                'temp_alert',
                'HACCP CRITICAL EXCURSION: ' || v_vehicle.name,
                'Reefer temperature spiked to ' || NEW.temperature || '°C (Max threshold is ' || v_vehicle.max_safe_temp || '°C). Cargo integrity at risk.',
                'critical',
                NEW.vehicle_id
            );
        ELSIF (NEW.temperature < v_vehicle.min_safe_temp) THEN
            INSERT INTO public.system_notifications (
                type,
                title,
                message,
                urgency,
                related_entity_id
            ) VALUES (
                'temp_alert',
                'TEMPERATURE WARNING: ' || v_vehicle.name,
                'Reefer temperature dropped to ' || NEW.temperature || '°C (Below minimum ' || v_vehicle.min_safe_temp || '°C).',
                'high',
                NEW.vehicle_id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reefer_telemetry_alert ON public.reefer_sensor_readings;
CREATE TRIGGER trg_reefer_telemetry_alert
AFTER INSERT ON public.reefer_sensor_readings
FOR EACH ROW EXECUTE FUNCTION public.check_reefer_telemetry_excursion();


-- 8. Atomic Fulfillment & Stock Deduction RPC Function
-- Requirements:
-- - SECURITY DEFINER with safe search path.
-- - Atomically checks the lot's available_weight_kg via row lock (FOR UPDATE).
-- - Rejects if requested weight exceeds available weight.
-- - Updates order line item with actual_weighed_kg.
-- - Decrements available_weight_kg and increments allocated_weight_kg on the lot.
CREATE OR REPLACE FUNCTION public.fn_fulfill_order_line_item(
    p_order_line_item_id UUID,
    p_actual_weighed_kg NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_lot RECORD;
    v_calling_role public.staff_role;
BEGIN
    -- Verify authorization: only admin or sales_staff or ops_staff
    SELECT role INTO v_calling_role
    FROM public.staff_profiles
    WHERE id = auth.uid() AND is_active = TRUE;

    IF v_calling_role NOT IN ('admin', 'ops_staff', 'sales_staff') THEN
        RAISE EXCEPTION 'Access Denied: Only operations or sales staff can weigh and allocate seafood inventory.';
    END IF;

    IF p_actual_weighed_kg <= 0 THEN
        RAISE EXCEPTION 'Actual weighed weight must be greater than zero kg.';
    END IF;

    -- Lock and retrieve the order line item
    SELECT * INTO v_item
    FROM public.order_line_items
    WHERE id = p_order_line_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order line item % not found.', p_order_line_item_id;
    END IF;

    -- Row lock on the referenced inventory batch lot
    SELECT id, species_name, available_weight_kg, allocated_weight_kg, wholesale_price_per_kg
    INTO v_lot
    FROM public.inventory_batches
    WHERE id = v_item.lot_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Referenced inventory batch lot % not found.', v_item.lot_id;
    END IF;

    -- Concurrency check: reject if requested weight exceeds available weight
    IF v_lot.available_weight_kg < p_actual_weighed_kg THEN
        RAISE EXCEPTION 'INSUFFICIENT STOCK IN LOT %: requested % kg, but only % kg available.',
            v_lot.id, p_actual_weighed_kg, v_lot.available_weight_kg;
    END IF;

    -- Atomically update inventory lot balances
    UPDATE public.inventory_batches
    SET available_weight_kg = available_weight_kg - p_actual_weighed_kg,
        allocated_weight_kg = allocated_weight_kg + p_actual_weighed_kg,
        updated_at = now()
    WHERE id = v_lot.id;

    -- Update the order line item
    UPDATE public.order_line_items
    SET actual_weighed_kg = p_actual_weighed_kg
    WHERE id = p_order_line_item_id;

    -- Update parent order adjusted total
    UPDATE public.client_orders
    SET adjusted_total_usd = (
        SELECT COALESCE(SUM(COALESCE(actual_weighed_kg, requested_weight_kg) * price_per_kg), 0)
        FROM public.order_line_items
        WHERE order_id = v_item.order_id
    ),
    status = CASE 
        WHEN status = 'Pending Confirmation' THEN 'Weighing & Grading'
        ELSE status 
    END,
    updated_at = now()
    WHERE id = v_item.order_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_line_item_id', p_order_line_item_id,
        'lot_id', v_lot.id,
        'actual_weighed_kg', p_actual_weighed_kg,
        'remaining_available_kg', (v_lot.available_weight_kg - p_actual_weighed_kg),
        'new_allocated_kg', (v_lot.allocated_weight_kg + p_actual_weighed_kg)
    );
END;
$$;

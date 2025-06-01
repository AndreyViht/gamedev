
# Руководство по Настройке Проверок Администратора в Supabase

Это руководство поможет вам убедиться, что все проверки прав администратора на стороне Supabase (в Edge Functions и SQL RPC функциях) настроены корректно для поддержки нескольких администраторов.

## 1. Проверка `user_viht_id` в метаданных пользователя

Каждый пользователь, который должен быть администратором, должен иметь корректный `user_viht_id` в своих метаданных.

1.  Перейдите в **Supabase Dashboard** -> **Authentication** -> **Users**.
2.  Найдите нужного пользователя (например, `lisenok319514@yandex.ru`).
3.  Откройте его данные и перейдите в раздел **User Metadata**.
4.  Убедитесь, что там есть запись вида:
    ```json
    {
      "user_viht_id": "viht-АБСОЛЮТНО_ТОЧНЫЙ_ID_АДМИНА"
      // ...другие метаданные...
    }
    ```
    Например, для второго администратора это должно быть `"user_viht_id": "viht-b2yn"`.
5.  Если этого поля нет или оно некорректно, его нужно добавить/исправить. Это можно сделать через SQL или через вашу RPC-функцию `admin_assign_viht_id_to_user` (если она корректно работает и проверяет права вызывающего администратора!).

## 2. Настройка Edge Function `get-user-by-viht-id`

Эта функция используется, например, в разделе "Управление Пользователями" админ-панели.

1.  Перейдите в **Supabase Dashboard** -> **Edge Functions**.
2.  Выберите вашу функцию `get-user-by-viht-id`.
3.  Перейдите на вкладку **Settings** (Настройки), затем в раздел **Environment Variables** (Переменные Окружения) или **Secrets** (Секреты).
4.  Убедитесь, что существует переменная с **Именем (Key)**: `ADMIN_USERS_JSON`.
5.  **Значение (Value)** для этой переменной должно быть валидной JSON-строкой, содержащей массив объектов всех администраторов. **Email указывайте в нижнем регистре, `viht_id` должен быть абсолютно точным.**
    ```json
    [{"email":"symmalop@gmail.com","viht_id":"viht-3owuiauy"},{"email":"lisenok319514@yandex.ru","viht_id":"viht-b2yn"}]
    ```
    *   **Критически важно:** `viht_id` здесь должен **АБСОЛЮТНО ТОЧНО** совпадать с `user_viht_id` из метаданных соответствующего пользователя.
6.  После сохранения переменных окружения, рекомендуется **переразвернуть (re-deploy)** Edge Function, чтобы она гарантированно подхватила новые значения.

**Код самой Edge Function `get-user-by-viht-id/index.ts` уже должен быть обновлен для поддержки этого JSON и нечувствительного к регистру сравнения email.**

## 3. Обновление ВСЕХ SQL RPC Функций, требующих прав администратора

Это самый частый источник проблем "Доступ запрещен" после добавления нового администратора. Вам нужно обновить **КАЖДУЮ** вашу SQL-функцию, которая должна вызываться только администраторами.

Примеры таких функций:
*   `admin_upsert_app_settings` (для сохранения настроек тарифов, рекламы на сайте и т.д.)
*   `admin_get_total_users_count`
*   `admin_get_total_logins_count`
*   `admin_update_user_metadata`
*   `admin_assign_viht_id_to_user` (эта функция сама должна проверять, что ее вызывает уже существующий администратор)
*   `get_top_users_by_activity_points` (если она только для админов)
*   И любые другие, созданные вами.

**Процесс обновления для КАЖДОЙ такой SQL-функции:**

1.  Перейдите в **Supabase Dashboard** -> **SQL Editor**.
2.  Найдите определение вашей функции (например, `CREATE OR REPLACE FUNCTION admin_upsert_app_settings(...) ...`).
3.  Внутри тела функции (между `AS $$` и `END; $$`) найдите блок `DECLARE`.
4.  В этом блоке `DECLARE` найдите строку, где объявляется массив `admin_viht_ids`.
5.  **Обновите этот массив**, добавив `viht_id` всех актуальных администраторов. Он должен выглядеть так:
    ```sql
    admin_viht_ids TEXT[] := ARRAY['viht-3owuiauy', 'viht-b2yn']; -- Убедитесь, что здесь ВСЕ админы!
    ```
6.  Убедитесь, что далее в коде функции идет корректная проверка прав, использующая этот массив:
    ```sql
    -- ... (внутри BEGIN ... END; блока функции)
    SELECT raw_user_meta_data->>'user_viht_id' INTO caller_viht_id FROM auth.users WHERE id = auth.uid();

    IF caller_viht_id IS NULL THEN
        RAISE EXCEPTION 'ACCESS_DENIED: VIHT ID for calling user (auth.uid: %) not found in metadata.', auth.uid();
    END IF;

    is_caller_admin := FALSE; -- Сброс перед проверкой
    IF caller_viht_id = ANY(admin_viht_ids) THEN
        is_caller_admin := TRUE;
    END IF;

    IF NOT is_caller_admin THEN
        RAISE EXCEPTION 'ACCESS_DENIED: Admin privileges required. (Caller VIHT ID: %, auth.uid: %)', caller_viht_id, auth.uid();
    END IF;
    -- Далее основная логика функции
    ```
7.  После внесения изменений в код функции, **выполните (Run)** этот обновленный `CREATE OR REPLACE FUNCTION ...` скрипт в SQL Editor, чтобы пересоздать функцию с новой логикой.

**Пример полной структуры SQL-функции с проверкой:**
```sql
CREATE OR REPLACE FUNCTION имя_вашей_админ_функции(параметры_если_есть)
RETURNS тип_возвращаемого_значения -- например, boolean, void, integer, SETOF table_type
LANGUAGE plpgsql
SECURITY DEFINER -- Очень важно для админских функций!
AS $$
DECLARE
    caller_viht_id TEXT;
    is_caller_admin BOOLEAN := FALSE;
    -- ОБЯЗАТЕЛЬНО ОБНОВИТЕ ЭТОТ СПИСОК АКТУАЛЬНЫМИ VIHT ID АДМИНИСТРАТОРОВ!
    admin_viht_ids TEXT[] := ARRAY['viht-3owuiauy', 'viht-b2yn'];
    -- ... другие переменные, необходимые для вашей функции ...
BEGIN
    -- === Начало проверки прав администратора ===
    SELECT raw_user_meta_data->>'user_viht_id'
    INTO caller_viht_id
    FROM auth.users
    WHERE id = auth.uid(); -- auth.uid() - ID текущего аутентифицированного пользователя, вызвавшего RPC

    IF caller_viht_id IS NULL THEN
        RAISE EXCEPTION 'ACCESS_DENIED: VIHT ID for calling user (auth.uid: %) not found in metadata.', auth.uid();
    END IF;

    is_caller_admin := FALSE; -- Сброс перед проверкой
    IF caller_viht_id = ANY(admin_viht_ids) THEN
        is_caller_admin := TRUE;
    END IF;

    IF NOT is_caller_admin THEN
        RAISE EXCEPTION 'ACCESS_DENIED: Admin privileges required. (Caller VIHT ID: %, auth.uid: %)', caller_viht_id, auth.uid();
    END IF;
    -- === Конец проверки прав администратора ===

    -- Здесь основная логика вашей RPC функции
    -- Например:
    -- RETURN true;
    -- INSERT INTO ... ;
    -- SELECT count(*) ...;
END;
$$;
```

## 4. Проверка Политик Безопасности на Уровне Строк (RLS)

Если у вас есть таблицы, доступ к которым для администраторов должен быть особым (например, `admin_chat_messages`, `app_settings`), убедитесь, что RLS политики для этих таблиц также корректно проверяют права всех администраторов, используя актуальный список `viht_id`.

Пример условия `USING` или `WITH CHECK` в политике:
```sql
(
  auth.role() = 'service_role' OR -- Разрешить сервисной роли (если используется)
  EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'user_viht_id' = ANY(ARRAY['viht-3owuiauy', 'viht-b2yn']) -- ОБНОВИТЕ ЗДЕСЬ!
  )
)
```

## 5. Проверка логов Supabase

Если проблемы не уходят:
*   **Логи Edge Function:** В Supabase Dashboard -> Edge Functions -> выберите функцию -> Logs.
*   **Логи Базы Данных:** В Supabase Dashboard -> Database -> Logs (или Query Performance для анализа запросов).

Эти логи могут дать точную информацию об ошибках, возникающих на стороне сервера.

---

Тщательно пройдитесь по всем этим пунктам. Ошибки "Доступ запрещен" почти всегда связаны с тем, что одна из этих серверных проверок не была обновлена для нового администратора.

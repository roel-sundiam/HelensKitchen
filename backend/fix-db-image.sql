-- Fix Spicy Bulgogi image path in SQLite database
UPDATE menu_items 
SET image_url = 'images/food/bulgogi/bulgogi_1.jpg' 
WHERE name = 'Spicy Bulgogi';

-- Verify the update
SELECT name, image_url FROM menu_items WHERE name = 'Spicy Bulgogi';
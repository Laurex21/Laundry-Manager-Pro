ALTER TABLE site_invitations
  ADD COLUMN IF NOT EXISTS notification_phone varchar(15);

// Схема БД. Миграции идемпотентны: повторный запуск ничего не ломает.
export const migrations: { id: string; sql: string }[] = [
  {
    id: '001_init',
    sql: `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('student','staff')),
  last_name text NOT NULL,
  first_name text NOT NULL,
  middle_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE faculties (
  id serial PRIMARY KEY,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  short text NOT NULL,
  dean_office_room text NOT NULL,
  dean_office_hours text NOT NULL,
  dean_office_phone text NOT NULL
);

CREATE TABLE groups (
  id serial PRIMARY KEY,
  name text UNIQUE NOT NULL,
  faculty_id int NOT NULL REFERENCES faculties(id),
  program_code text NOT NULL,
  program_name text NOT NULL,
  profile text,
  course int NOT NULL,
  curator text
);

CREATE TABLE students (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  group_id int NOT NULL REFERENCES groups(id),
  study_form text NOT NULL,
  funding text NOT NULL,
  enrolled_year int NOT NULL,
  record_book_enc text,
  email_enc text,
  phone_enc text,
  birth_date_enc text,
  stipend text,
  avatar_hue int NOT NULL DEFAULT 160
);
CREATE INDEX ON students(group_id);

CREATE TABLE staff (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  position text NOT NULL,
  faculty_id int REFERENCES faculties(id)
);

CREATE TABLE sessions (
  id bigserial PRIMARY KEY,
  token_hash text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  user_agent text,
  ip text
);
CREATE INDEX ON sessions(user_id);

CREATE TABLE login_attempts (
  id bigserial PRIMARY KEY,
  login text,
  ip text,
  ok boolean NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON login_attempts(ip, at);

CREATE TABLE disciplines (
  id serial PRIMARY KEY,
  group_id int NOT NULL REFERENCES groups(id),
  code text NOT NULL,
  name text NOT NULL,
  short text NOT NULL,
  teacher text NOT NULL,
  credits int NOT NULL,
  control text NOT NULL CHECK (control IN ('exam','zachet','diff')),
  hue int NOT NULL
);
CREATE INDEX ON disciplines(group_id);

CREATE TABLE lessons (
  id serial PRIMARY KEY,
  discipline_id int NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
  weekday int NOT NULL CHECK (weekday BETWEEN 1 AND 6),
  slot int NOT NULL,
  kind text NOT NULL,
  room text NOT NULL,
  teacher text NOT NULL,
  parity text NOT NULL DEFAULT 'all' CHECK (parity IN ('all','odd','even'))
);

CREATE TABLE lesson_changes (
  id serial PRIMARY KEY,
  lesson_id int NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  on_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('moved','cancelled','room','teacher')),
  new_date date,
  new_slot int,
  new_room text,
  new_teacher text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON lesson_changes(on_date);

CREATE TABLE control_points (
  id serial PRIMARY KEY,
  discipline_id int NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL,
  due_date date NOT NULL,
  max_score int NOT NULL
);
CREATE INDEX ON control_points(discipline_id);

CREATE TABLE scores (
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  control_point_id int NOT NULL REFERENCES control_points(id) ON DELETE CASCADE,
  score numeric(5,1) NOT NULL,
  graded_at date NOT NULL,
  PRIMARY KEY (student_id, control_point_id)
);

CREATE TABLE attendance (
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discipline_id int NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
  attended int NOT NULL,
  total int NOT NULL,
  PRIMARY KEY (student_id, discipline_id)
);

CREATE TABLE exams (
  id serial PRIMARY KEY,
  discipline_id int NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
  kind text NOT NULL,
  starts_at timestamptz NOT NULL,
  room text NOT NULL,
  consultation_at timestamptz,
  consultation_room text
);

CREATE TABLE record_book (
  id serial PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  semester int NOT NULL,
  discipline text NOT NULL,
  control text NOT NULL,
  result text NOT NULL,
  points int,
  credits int NOT NULL,
  teacher text NOT NULL,
  passed_on date NOT NULL
);
CREATE INDEX ON record_book(student_id);

CREATE TABLE requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('submitted','review','preparing','needs_info','ready','done','rejected')),
  verify_code text UNIQUE,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON requests(student_id, created_at DESC);
CREATE INDEX ON requests(status);
CREATE SEQUENCE request_no START 140;

CREATE TABLE request_events (
  id bigserial PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  status text NOT NULL,
  comment text,
  actor_role text NOT NULL,
  actor_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON request_events(request_id, created_at);

CREATE TABLE notifications (
  id serial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('news','change','deadline','request','system')),
  title text NOT NULL,
  body text NOT NULL,
  link text,
  important boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  faculty_id int REFERENCES faculties(id),
  group_id int REFERENCES groups(id),
  author text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON notifications(created_at DESC);

CREATE TABLE notification_reads (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id int NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, notification_id)
);

CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  user_id uuid,
  action text NOT NULL,
  target text,
  ip text,
  at timestamptz NOT NULL DEFAULT now()
);
`,
  },
];

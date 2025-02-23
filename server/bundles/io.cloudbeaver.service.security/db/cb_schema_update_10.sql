CREATE TABLE CB_USER_SECRETS
(
    USER_ID                        VARCHAR(128) NOT NULL,
    SECRET_ID                      VARCHAR(512) NOT NULL,
    SECRET_VALUE                   VARCHAR(30000) NOT NULL,

    SECRET_LABEL                   VARCHAR(128),
    SECRET_DESCRIPTION             VARCHAR(1024),

    UPDATE_TIME                    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (USER_ID, SECRET_ID),
    FOREIGN KEY (USER_ID) REFERENCES CB_USER (USER_ID) ON DELETE CASCADE
);

CREATE INDEX CB_USER_SECRETS_ID ON CB_USER_SECRETS (USER_ID,SECRET_ID);


/*
 * DBeaver - Universal Database Manager
 * Copyright (C) 2010-2022 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package io.cloudbeaver.model;

import io.cloudbeaver.server.ConfigurationUtils;
import org.jkiss.code.NotNull;
import org.jkiss.dbeaver.DBException;
import org.jkiss.dbeaver.model.DBPDataSourceContainer;
import org.jkiss.dbeaver.model.DBPDataSourceHandler;
import org.jkiss.dbeaver.model.runtime.DBRProgressMonitor;

public class WebDatasourceAccessCheckHandler implements DBPDataSourceHandler {
    @Override
    public void beforeConnect(DBRProgressMonitor monitor, @NotNull DBPDataSourceContainer dataSourceContainer) throws DBException {
        if (!ConfigurationUtils.isDriverEnabled(dataSourceContainer.getDriver())) {
            throw new DBException("Driver disabled");
        }
    }

    @Override
    public void beforeDisconnect(DBRProgressMonitor monitor, @NotNull DBPDataSourceContainer dataSourceContainer) throws DBException {

    }
}

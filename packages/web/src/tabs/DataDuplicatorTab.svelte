<script lang="ts" context="module">
  const getCurrentEditor = () => getActiveComponent('DataDuplicatorTab');

  registerCommand({
    id: 'dataDuplicator.run',
    category: 'Data duplicator',
    name: 'Import into DB',
    keyText: 'F5 | CtrlOrCommand+Enter',
    toolbar: true,
    isRelatedToTab: true,
    icon: 'icon run',
    testEnabled: () => getCurrentEditor()?.canRun(),
    onClick: () => getCurrentEditor().run(),
  });
</script>

<script lang="ts">
  import { ScriptWriter, ScriptWriterJson } from 'dbgate-tools';

  import _ from 'lodash';
  import ToolStripCommandButton from '../buttons/ToolStripCommandButton.svelte';
  import ToolStripContainer from '../buttons/ToolStripContainer.svelte';
  import invalidateCommands from '../commands/invalidateCommands';
  import registerCommand from '../commands/registerCommand';
  import ObjectConfigurationControl from '../elements/ObjectConfigurationControl.svelte';
  import TableControl from '../elements/TableControl.svelte';
  import VerticalSplitter from '../elements/VerticalSplitter.svelte';
  import CheckboxField from '../forms/CheckboxField.svelte';
  import SelectField from '../forms/SelectField.svelte';
  import { extractShellConnection } from '../impexp/createImpExpScript';
  import SocketMessageView from '../query/SocketMessageView.svelte';
  import useEditorData from '../query/useEditorData';
  import { getCurrentConfig } from '../stores';
  import { apiCall, apiOff, apiOn } from '../utility/api';
  import { changeTab } from '../utility/common';
  import createActivator, { getActiveComponent } from '../utility/createActivator';
  import { useArchiveFiles, useArchiveFolders, useConnectionInfo, useDatabaseInfo } from '../utility/metadataLoaders';
  import useEffect from '../utility/useEffect';

  export let conid;
  export let database;
  export let tabid;

  let busy = false;
  let runnerId = null;
  let executeNumber = 0;

  export const activator = createActivator('DataDuplicatorTab', true);

  $: connection = useConnectionInfo({ conid });
  $: dbinfo = useDatabaseInfo({ conid, database });

  $: archiveFolders = useArchiveFolders();
  $: archiveFiles = useArchiveFiles({ folder: $editorState?.value?.archiveFolder });

  $: pairedNames = _.intersectionBy(
    $dbinfo?.tables?.map(x => x.pureName),
    $archiveFiles?.map(x => x.name),
    (x: string) => _.toUpper(x)
  );

  $: {
    changeTab(tabid, tab => ({ ...tab, busy }));
  }

  $: {
    busy;
    runnerId;
    tableRows;
    invalidateCommands();
  }

  const { editorState, editorValue, setEditorData } = useEditorData({
    tabid,
    onInitialData: value => {
      invalidateCommands();
    },
  });

  function changeTable(row) {
    setEditorData(old => ({
      ...old,
      tables: {
        ...old?.tables,
        [row.name]: row,
      },
    }));
  }

  function createScript(forceScript = false) {
    const config = getCurrentConfig();
    const script = config.allowShellScripting || forceScript ? new ScriptWriter() : new ScriptWriterJson();
    script.dataDuplicator({
      connection: extractShellConnection($connection, database),
      archive: $editorState.value.archiveFolder,
      items: tableRows
        .filter(x => x.isChecked)
        .map(row => ({
          name: row.name,
          operation: row.operation,
          matchColumns: _.compact([row.matchColumn1]),
        })),
    });
    return script.getScript();
  }

  export function canRun() {
    return !!tableRows.find(x => x.isChecked) && !busy;
  }

  export async function run() {
    if (busy) return;
    executeNumber += 1;
    busy = true;
    const script = await createScript();
    let runid = runnerId;
    const resp = await apiCall('runners/start', { script });
    runid = resp.runid;
    runnerId = runid;
  }

  $: effect = useEffect(() => registerRunnerDone(runnerId));

  function registerRunnerDone(rid) {
    if (rid) {
      apiOn(`runner-done-${rid}`, handleRunnerDone);
      return () => {
        apiOff(`runner-done-${rid}`, handleRunnerDone);
      };
    } else {
      return () => {};
    }
  }

  $: $effect;

  const handleRunnerDone = () => {
    busy = false;
  };

  // $: console.log('$archiveFiles', $archiveFiles);
  // $: console.log('$editorState', $editorState.value);

  $: tableRows = pairedNames.map(name => {
    const item = $editorState?.value?.tables?.[name];
    const isChecked = item?.isChecked ?? true;
    const operation = item?.operation ?? 'copy';
    const tableInfo = $dbinfo?.tables?.find(x => x.pureName?.toUpperCase() == name.toUpperCase());
    const matchColumn1 =
      item?.matchColumn1 ?? tableInfo?.primaryKey?.columns?.[0]?.columnName ?? tableInfo?.columns?.[0]?.columnName;

    return {
      name,
      isChecked,
      operation,
      matchColumn1,
      file: `${name}.jsonl`,
      table: tableInfo?.schemaName ? `${tableInfo?.schemaName}.${tableInfo?.pureName}` : tableInfo?.pureName,
    };
  });

  // $: console.log('$archiveFolders', $archiveFolders);
</script>

<ToolStripContainer>
  <VerticalSplitter>
    <svelte:fragment slot="1">
      <div class="wrapper">
        <ObjectConfigurationControl title="Configuration">
          <div class="bold m-2">Source archive</div>
          <SelectField
            isNative
            value={$editorState.value?.archiveFolder}
            on:change={e => {
              setEditorData(old => ({
                ...old,
                archiveFolder: e.detail,
              }));
            }}
            options={$archiveFolders?.map(x => ({
              label: x.name,
              value: x.name,
            })) || []}
          />
        </ObjectConfigurationControl>

        <ObjectConfigurationControl title="Imported files">
          <TableControl
            rows={tableRows}
            columns={[
              { header: '', fieldName: 'isChecked', slot: 1 },
              { header: 'Source file', fieldName: 'file' },
              { header: 'Target table', fieldName: 'table' },
              { header: 'Operation', fieldName: 'operation', slot: 2 },
              { header: 'Match column', fieldName: 'matchColumn1', slot: 3 },
            ]}
          >
            <svelte:fragment slot="1" let:row>
              <CheckboxField
                checked={row.isChecked}
                on:change={e => {
                  changeTable({ ...row, isChecked: e.target.checked });
                }}
              />
            </svelte:fragment>
            <svelte:fragment slot="2" let:row>
              <SelectField
                isNative
                value={row.operation}
                on:change={e => {
                  changeTable({ ...row, operation: e.detail });
                }}
                disabled={!row.isChecked}
                options={[
                  { label: 'Copy row', value: 'copy' },
                  { label: 'Lookup (find matching row)', value: 'lookup' },
                  { label: 'Insert if not exists', value: 'insertMissing' },
                ]}
              />
            </svelte:fragment>
            <svelte:fragment slot="3" let:row>
              {#if row.operation != 'copy'}
                <SelectField
                  isNative
                  value={row.matchColumn1}
                  on:change={e => {
                    changeTable({ ...row, matchColumn1: e.detail });
                  }}
                  disabled={!row.isChecked}
                  options={$dbinfo?.tables
                    ?.find(x => x.pureName?.toUpperCase() == row.name.toUpperCase())
                    ?.columns?.map(col => ({
                      label: col.columnName,
                      value: col.columnName,
                    })) || []}
                />
              {/if}
            </svelte:fragment>
          </TableControl>
        </ObjectConfigurationControl>
      </div>
    </svelte:fragment>
    <svelte:fragment slot="2">
      <SocketMessageView eventName={runnerId ? `runner-info-${runnerId}` : null} {executeNumber} showNoMessagesAlert />
    </svelte:fragment>
  </VerticalSplitter>

  <svelte:fragment slot="toolstrip">
    <ToolStripCommandButton command="dataDuplicator.run" />
  </svelte:fragment>
</ToolStripContainer>

<!-- <div>
  {#each pairedNames as name}
    <div>{name}</div>
  {/each}
</div> -->

<!-- <style>
    .title {
        font-weight: bold;
    }
</style> -->
<style>
  .wrapper {
    overflow-y: auto;
    background-color: var(--theme-bg-0);
    flex: 1;
    display: flex;
    flex-direction: column;
  }
</style>

<script lang="ts">
  import _ from 'lodash';

  import ManagerInnerContainer from '../elements/ManagerInnerContainer.svelte';
  import JsonViewFilterColumn from './JsonViewFilterColumn.svelte';

  export let managerSize;
  export let display;
  export let isDynamicStructure;
  export let useEvalFilters;

  $: filters = display?.config?.filters;

  $: allFilterNames = _.keys(filters || {});
</script>

<ManagerInnerContainer width={managerSize}>
  {#each allFilterNames as uniqueName}
    <JsonViewFilterColumn {uniqueName} {display} {filters} {isDynamicStructure} {useEvalFilters} />
  {/each}
</ManagerInnerContainer>

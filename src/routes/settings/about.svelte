<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
import { version } from "$app/env";
import Section from "./section.svelte";
</script>

<Section
	id="about"
	title="About"
	description="Application information and legal notices."
>
	<dl
		class="m-0 grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-3 text-[13px]"
	>
		<dt class="text-muted-foreground">Application</dt>
		<dd class="m-0">Pprof-Viz Web</dd>
		<dt class="text-muted-foreground">Build</dt>
		<dd class="mono m-0">{version}</dd>
		<dt class="text-muted-foreground">Identifier</dt>
		<dd class="mono m-0">de.tb004.pprof-viz</dd>
		<dt class="text-muted-foreground">Repository</dt>
		<dd class="m-0 min-w-0">
			<a
				href="https://github.com/TB004/pprof-viz-web"
				target="_blank"
				rel="noreferrer noopener"
				class="text-acc underline-offset-4 hover:underline"
			>
				github.com/TB004/pprof-viz-web
			</a>
		</dd>
		<dt class="text-muted-foreground">Copyright</dt>
		<dd class="m-0">© 2026 Tizian Bahr</dd>
		<dt class="text-muted-foreground">License</dt>
		<dd class="m-0">GPL-3.0-or-later</dd>
	</dl>
</Section>

<!--
  Copyright (C) 2026 Tizian Bahr
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script lang="ts">
let {
	values,
	color,
	height = 28,
	fill = false,
	class: className,
}: {
	values: number[];
	color: string;
	height?: number;
	/** Shade the area under the line. */
	fill?: boolean;
	class?: string;
} = $props();

const WIDTH = 100;

const paths = $derived.by(() => {
	if (values.length < 2) return { line: "", area: "" };
	let min = Math.min(...values);
	let max = Math.max(...values);
	if (max === min) {
		max += 1;
		min -= 1;
	}
	const points = values.map((v, i) => {
		const x = (i / (values.length - 1)) * WIDTH;
		const y = height - 2 - ((v - min) / (max - min)) * (height - 6);
		return `${x.toFixed(1)},${y.toFixed(1)}`;
	});
	const line = `M${points.join("L")}`;
	return { line, area: `${line}L${WIDTH},${height}L0,${height}Z` };
});
</script>

<svg
	viewBox="0 0 {WIDTH} {height}"
	preserveAspectRatio="none"
	class={className}
	aria-hidden="true"
>
	{#if fill}
		<path d={paths.area} fill={color} fill-opacity="0.14" stroke="none" />
	{/if}
	<path
		d={paths.line}
		fill="none"
		stroke={color}
		stroke-width="1.5"
		stroke-linejoin="round"
		vector-effect="non-scaling-stroke"
	/>
</svg>

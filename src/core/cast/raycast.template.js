import { intersectRay } from '../utils/intersectUtils.js';
import { COUNT, OFFSET, LEFT_NODE, RIGHT_NODE, IS_LEAF } from '../utils/nodeBufferUtils.js';
import { BufferStack } from '../utils/BufferStack.js';
import { intersectTris } from '../utils/iterationUtils.generated.js';
import { intersectTris_indirect } from '../utils/iterationUtils_indirect.generated.js';

export function raycast/* @echo INDIRECT_STRING */( bvh, root, side, ray, intersects, near, far ) {

	BufferStack.setBuffer( bvh._roots[ root ] );
	_raycast( 0, bvh, side, ray, intersects, near, far );
	BufferStack.clearBuffer();

}

function _raycast( nodeIndex32, bvh, side, ray, intersects, near, far ) {

	const { float32Array, uint16Array, uint32Array } = BufferStack;
	const nodeIndex16 = nodeIndex32 * 2;
	const isLeaf = IS_LEAF( nodeIndex16, uint16Array );
	if ( isLeaf ) {

		const offset = OFFSET( nodeIndex32, uint32Array );
		const count = COUNT( nodeIndex16, uint16Array );

		/* @if INDIRECT */

		// It might happen that a triangle less distant than 'near' is selected here. Should we add the near check here too? is it worth it? It might slow down to handle really rare cases

		intersectTris_indirect( bvh, side, ray, offset, count, intersects );

		/* @else */

		intersectTris( bvh, side, ray, offset, count, intersects );

		/* @endif */

	} else {

		const leftIndex = LEFT_NODE( nodeIndex32 );
		if ( intersectRay( leftIndex, float32Array, ray, near, far ) ) {

			_raycast( leftIndex, bvh, side, ray, intersects, near, far );

		}

		const rightIndex = RIGHT_NODE( nodeIndex32, uint32Array );
		if ( intersectRay( rightIndex, float32Array, ray, near, far ) ) {

			_raycast( rightIndex, bvh, side, ray, intersects, near, far );

		}

	}

}

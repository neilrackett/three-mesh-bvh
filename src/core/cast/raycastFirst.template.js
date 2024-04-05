import { COUNT, OFFSET, LEFT_NODE, RIGHT_NODE, IS_LEAF, SPLIT_AXIS } from '../utils/nodeBufferUtils.js';
import { BufferStack } from '../utils/BufferStack.js';
import { intersectRay } from '../utils/intersectUtils.js';
import { intersectClosestTri } from '../utils/iterationUtils.generated.js';
import { intersectClosestTri_indirect } from '../utils/iterationUtils_indirect.generated.js';
const _xyzFields = [ 'x', 'y', 'z' ];

const origin = new Float32Array(3);
const dirInv = new Float32Array(3);
const sign = new Uint8Array(3);


export function raycastFirst/* @echo INDIRECT_STRING */( bvh, root, side, ray ) {

    // const distance = raycaster.far;

    origin[0] = ray.origin.x;
    origin[1] = ray.origin.y;
    origin[2] = ray.origin.z;

    dirInv[0] = 1 / ray.direction.x;
    dirInv[1] = 1 / ray.direction.y;
    dirInv[2] = 1 / ray.direction.z;

    sign[0] = dirInv[0] < 0 ? 3 : 0;
    sign[1] = dirInv[1] < 0 ? 3 : 0;
    sign[2] = dirInv[2] < 0 ? 3 : 0;

	BufferStack.setBuffer( bvh._roots[ root ] );
	const result = _raycastFirst( 0, bvh, side, ray );
	BufferStack.clearBuffer();

	return result;

}

function _raycastFirst( nodeIndex32, bvh, side, ray ) {

	const { float32Array, uint16Array, uint32Array } = BufferStack;
	let nodeIndex16 = nodeIndex32 * 2;

	const isLeaf = IS_LEAF( nodeIndex16, uint16Array );
	if ( isLeaf ) {

		const offset = OFFSET( nodeIndex32, uint32Array );
		const count = COUNT( nodeIndex16, uint16Array );

		/* @if INDIRECT */

		return intersectClosestTri_indirect( bvh, side, ray, offset, count );

		/* @else */

		return intersectClosestTri( bvh, side, ray, offset, count );

		/* @endif */

	} else {

		// consider the position of the split plane with respect to the oncoming ray; whichever direction
		// the ray is coming from, look for an intersection among that side of the tree first
		const splitAxis = SPLIT_AXIS( nodeIndex32, uint32Array );
		const xyzAxis = _xyzFields[ splitAxis ];
		const rayDir = ray.direction[ xyzAxis ];
		const leftToRight = rayDir >= 0;

		// c1 is the child to check first
		let c1, c2;
		if ( leftToRight ) {

			c1 = LEFT_NODE( nodeIndex32 );
			c2 = RIGHT_NODE( nodeIndex32, uint32Array );

		} else {

			c1 = RIGHT_NODE( nodeIndex32, uint32Array );
			c2 = LEFT_NODE( nodeIndex32 );

		}

		const c1Intersection = intersectRay( c1, float32Array, origin, dirInv, sign );
		const c1Result = c1Intersection ? _raycastFirst( c1, bvh, side, ray ) : null;

		// if we got an intersection in the first node and it's closer than the second node's bounding
		// box, we don't need to consider the second node because it couldn't possibly be a better result
		if ( c1Result ) {

			// check if the point is within the second bounds
			// "point" is in the local frame of the bvh
			const point = c1Result.point[ xyzAxis ];
			const isOutside = leftToRight ?
				point <= float32Array[ c2 + splitAxis ] : // min bounding data
				point >= float32Array[ c2 + splitAxis + 3 ]; // max bounding data

			if ( isOutside ) {

				return c1Result;

			}

		}

		// either there was no intersection in the first node, or there could still be a closer
		// intersection in the second, so check the second node and then take the better of the two
		const c2Intersection = intersectRay( c2, float32Array, origin, dirInv, sign );
		const c2Result = c2Intersection ? _raycastFirst( c2, bvh, side, ray) : null;

		if ( c1Result && c2Result ) {

			return c1Result.distance <= c2Result.distance ? c1Result : c2Result;

		} else {

			return c1Result || c2Result || null;

		}

	}

}

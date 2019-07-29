/******************************************************************************
 * Spine Runtimes Software License
 * Version 2.5
 *
 * Copyright (c) 2013-2016, Esoteric Software
 * All rights reserved.
 *
 * You are granted a perpetual, non-exclusive, non-sublicensable, and
 * non-transferable license to use, install, execute, and perform the Spine
 * Runtimes software and derivative works solely for personal or internal
 * use. Without the written permission of Esoteric Software (see Section 2 of
 * the Spine Software License Agreement), you may not (a) modify, translate,
 * adapt, or develop new applications using the Spine Runtimes or otherwise
 * create derivative works or improvements of the Spine Runtimes or (b) remove,
 * delete, alter, or obscure any trademarks or any copyright, trademark, patent,
 * or other intellectual property or proprietary rights notices on or in the
 * Software, including any copy thereof. Redistributions in binary or source
 * form must include this license and terms.
 *
 * THIS SOFTWARE IS PROVIDED BY ESOTERIC SOFTWARE "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
 * EVENT SHALL ESOTERIC SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES, BUSINESS INTERRUPTION, OR LOSS OF
 * USE, DATA, OR PROFITS) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/

namespace pixi_spine.core {
    export class TransformConstraint implements Constraint {
        data: TransformConstraintData;
        bones: Array<Bone>;
        target: Bone;
        rotateMix = 0;
        translateMix = 0;
        scaleMix = 0;
        shearMix = 0;
        temp = new Vector2();

        constructor(data: TransformConstraintData, skeleton: Skeleton) {
            if (data == null) throw new Error("data cannot be null.");
            if (skeleton == null) throw new Error("skeleton cannot be null.");
            this.data = data;
            this.rotateMix = data.rotateMix;
            this.translateMix = data.translateMix;
            this.scaleMix = data.scaleMix;
            this.shearMix = data.shearMix;
            this.bones = new Array<Bone>();
            for (let i = 0; i < data.bones.length; i++)
                this.bones.push(skeleton.findBone(data.bones[i].name));
            this.target = skeleton.findBone(data.target.name);
        }

        apply() {
            this.update();
        }

        update() {
            if (this.data.local) {
                if (this.data.relative)
                    this.applyRelativeLocal();
                else
                    this.applyAbsoluteLocal();

            } else {
                if (this.data.relative)
                    this.applyRelativeWorld();
                else
                    this.applyAbsoluteWorld();
            }
        }

        applyAbsoluteWorld() {
            let rotateMix = this.rotateMix, translateMix = this.translateMix, scaleMix = this.scaleMix,
                shearMix = this.shearMix;
            let target = this.target;
            let targetMat = target.matrix;
            let ta = targetMat.a, tb = targetMat.c, tc = targetMat.b, td = targetMat.d;
            let degRadReflect = ta * td - tb * tc > 0 ? MathUtils.degRad : -MathUtils.degRad;
            let offsetRotation = this.data.offsetRotation * degRadReflect;
            let offsetShearY = this.data.offsetShearY * degRadReflect;
            let bones = this.bones;
            for (let i = 0, n = bones.length; i < n; i++) {
                let bone = bones[i];
                let modified = false;
                let mat = bone.matrix;

                if (rotateMix != 0) {
                    let a = mat.a, b = mat.c, c = mat.b, d = mat.d;
                    let r = Math.atan2(tc, ta) - Math.atan2(c, a) + offsetRotation;
                    if (r > MathUtils.PI)
                        r -= MathUtils.PI2;
                    else if (r < -MathUtils.PI)
                        r += MathUtils.PI2;
                    r *= rotateMix;
                    let cos = Math.cos(r), sin = Math.sin(r);
                    mat.a = cos * a - sin * c;
                    mat.c = cos * b - sin * d;
                    mat.b = sin * a + cos * c;
                    mat.d = sin * b + cos * d;
                    modified = true;
                }

                if (translateMix != 0) {
                    let temp = this.temp;
                    target.localToWorld(temp.set(this.data.offsetX, this.data.offsetY));
                    mat.tx += (temp.x - mat.tx) * translateMix;
                    mat.ty += (temp.y - mat.ty) * translateMix;
                    modified = true;
                }

                if (scaleMix > 0) {
                    let s = Math.sqrt(mat.a * mat.a + mat.b * mat.b);
                    let ts = Math.sqrt(ta * ta + tc * tc);
                    if (s > 0.00001) s = (s + (ts - s + this.data.offsetScaleX) * scaleMix) / s;
                    mat.a *= s;
                    mat.b *= s;
                    s = Math.sqrt(mat.c * mat.c + mat.d * mat.d);
                    ts = Math.sqrt(tb * tb + td * td);
                    if (s > 0.00001) s = (s + (ts - s + this.data.offsetScaleY) * scaleMix) / s;
                    mat.c *= s;
                    mat.d *= s;
                    modified = true;
                }

                if (shearMix > 0) {
                    let b = mat.c, d = mat.d;
                    let by = Math.atan2(d, b);
                    let r = Math.atan2(td, tb) - Math.atan2(tc, ta) - (by - Math.atan2(mat.b, mat.a));
                    if (r > MathUtils.PI)
                        r -= MathUtils.PI2;
                    else if (r < -MathUtils.PI)
                        r += MathUtils.PI2;
                    r = by + (r + offsetShearY) * shearMix;
                    let s = Math.sqrt(b * b + d * d);
                    mat.c = Math.cos(r) * s;
                    mat.d = Math.sin(r) * s;
                    modified = true;
                }

                if (modified) bone.appliedValid = false;
            }
        }

        applyRelativeWorld() {
            let rotateMix = this.rotateMix, translateMix = this.translateMix, scaleMix = this.scaleMix,
                shearMix = this.shearMix;
            let target = this.target;
            let targetMat = target.matrix;
            let ta = targetMat.a, tb = targetMat.c, tc = targetMat.b, td = targetMat.d;
            let degRadReflect = ta * td - tb * tc > 0 ? MathUtils.degRad : -MathUtils.degRad;
            let offsetRotation = this.data.offsetRotation * degRadReflect,
                offsetShearY = this.data.offsetShearY * degRadReflect;
            let bones = this.bones;
            for (let i = 0, n = bones.length; i < n; i++) {
                let bone = bones[i];
                let modified = false;
                let mat = bone.matrix;

                if (rotateMix != 0) {
                    let a = mat.a, b = mat.c, c = mat.b, d = mat.d;
                    let r = Math.atan2(tc, ta) + offsetRotation;
                    if (r > MathUtils.PI)
                        r -= MathUtils.PI2;
                    else if (r < -MathUtils.PI) r += MathUtils.PI2;
                    r *= rotateMix;
                    let cos = Math.cos(r), sin = Math.sin(r);
                    mat.a = cos * a - sin * c;
                    mat.c = cos * b - sin * d;
                    mat.b = sin * a + cos * c;
                    mat.d = sin * b + cos * d;
                    modified = true;
                }

                if (translateMix != 0) {
                    let temp = this.temp;
                    target.localToWorld(temp.set(this.data.offsetX, this.data.offsetY));
                    mat.tx += temp.x * translateMix;
                    mat.ty += temp.y * translateMix;
                    modified = true;
                }

                if (scaleMix > 0) {
                    let s = (Math.sqrt(ta * ta + tc * tc) - 1 + this.data.offsetScaleX) * scaleMix + 1;
                    mat.a *= s;
                    mat.b *= s;
                    s = (Math.sqrt(tb * tb + td * td) - 1 + this.data.offsetScaleY) * scaleMix + 1;
                    mat.c *= s;
                    mat.d *= s;
                    modified = true;
                }

                if (shearMix > 0) {
                    let r = Math.atan2(td, tb) - Math.atan2(tc, ta);
                    if (r > MathUtils.PI)
                        r -= MathUtils.PI2;
                    else if (r < -MathUtils.PI) r += MathUtils.PI2;
                    let b = mat.c, d = mat.d;
                    r = Math.atan2(d, b) + (r - MathUtils.PI / 2 + offsetShearY) * shearMix;
                    let s = Math.sqrt(b * b + d * d);
                    mat.c = Math.cos(r) * s;
                    mat.d = Math.sin(r) * s;
                    modified = true;
                }

                if (modified) bone.appliedValid = false;
            }
        }

        applyAbsoluteLocal() {
            let rotateMix = this.rotateMix, translateMix = this.translateMix, scaleMix = this.scaleMix,
                shearMix = this.shearMix;
            let target = this.target;
            if (!target.appliedValid) target.updateAppliedTransform();
            let bones = this.bones;
            for (let i = 0, n = bones.length; i < n; i++) {
                let bone = bones[i];
                if (!bone.appliedValid) bone.updateAppliedTransform();

                let rotation = bone.arotation;
                if (rotateMix != 0) {
                    let r = target.arotation - rotation + this.data.offsetRotation;
                    r -= (16384 - ((16384.499999999996 - r / 360) | 0)) * 360;
                    rotation += r * rotateMix;
                }

                let x = bone.ax, y = bone.ay;
                if (translateMix != 0) {
                    x += (target.ax - x + this.data.offsetX) * translateMix;
                    y += (target.ay - y + this.data.offsetY) * translateMix;
                }

                let scaleX = bone.ascaleX, scaleY = bone.ascaleY;
                if (scaleMix > 0) {
                    if (scaleX > 0.00001) scaleX = (scaleX + (target.ascaleX - scaleX + this.data.offsetScaleX) * scaleMix) / scaleX;
                    if (scaleY > 0.00001) scaleY = (scaleY + (target.ascaleY - scaleY + this.data.offsetScaleY) * scaleMix) / scaleY;
                }

                let shearY = bone.ashearY;
                if (shearMix > 0) {
                    let r = target.ashearY - shearY + this.data.offsetShearY;
                    r -= (16384 - ((16384.499999999996 - r / 360) | 0)) * 360;
                    bone.shearY += r * shearMix;
                }

                bone.updateWorldTransformWith(x, y, rotation, scaleX, scaleY, bone.ashearX, shearY);
            }
        }

        applyRelativeLocal() {
            let rotateMix = this.rotateMix, translateMix = this.translateMix, scaleMix = this.scaleMix,
                shearMix = this.shearMix;
            let target = this.target;
            if (!target.appliedValid) target.updateAppliedTransform();
            let bones = this.bones;
            for (let i = 0, n = bones.length; i < n; i++) {
                let bone = bones[i];
                if (!bone.appliedValid) bone.updateAppliedTransform();

                let rotation = bone.arotation;
                if (rotateMix != 0) rotation += (target.arotation + this.data.offsetRotation) * rotateMix;

                let x = bone.ax, y = bone.ay;
                if (translateMix != 0) {
                    x += (target.ax + this.data.offsetX) * translateMix;
                    y += (target.ay + this.data.offsetY) * translateMix;
                }

                let scaleX = bone.ascaleX, scaleY = bone.ascaleY;
                if (scaleMix > 0) {
                    if (scaleX > 0.00001) scaleX *= ((target.ascaleX - 1 + this.data.offsetScaleX) * scaleMix) + 1;
                    if (scaleY > 0.00001) scaleY *= ((target.ascaleY - 1 + this.data.offsetScaleY) * scaleMix) + 1;
                }

                let shearY = bone.ashearY;
                if (shearMix > 0) shearY += (target.ashearY + this.data.offsetShearY) * shearMix;

                bone.updateWorldTransformWith(x, y, rotation, scaleX, scaleY, bone.ashearX, shearY);
            }
        }

        getOrder() {
            return this.data.order;
        }
    }

}

"""A robot for the browser: its model, its meshes and its motion, as DATA.

    python3 tools/robot_webgl.py path/to/robot.urdf assets/robots/arm3d

Nothing is rendered here. Where tools/mujoco_render.py filmed the robot once
and for all, this writes what the BROWSER needs to draw it itself, live
(lectures/lib/robot3d.js):

    <stem>.bin    the visual meshes, as MuJoCo compiles them: float32
                  positions then uint32 triangles, mesh after mesh
    <stem>.json   the kinematic tree, the visual geoms and their colours,
                  where each mesh sits in the .bin, the motion as joint
                  configurations, and the camera the film used

The motion comes from the film's own track (`--track`), so the robot moves
exactly as the video did; without one it is the sweep of mujoco_render.py,
sampled here. The camera is framed by the SAME code as the film, so the live
picture stands where the film stood and everything the lecture draws over it
keeps its place.

The motion comes from a file of joint configurations (`--track`), or, without
one, from a sweep that takes every joint through its range and closes on
itself so that it loops.
"""

import argparse, json, os, re, tempfile
import xml.etree.ElementTree as ET

import numpy as np

os.environ.setdefault("MUJOCO_GL", "egl")
import mujoco


# --- reading the model ------------------------------------------------------

def load_model(path):
    """Load a URDF keeping its VISUAL meshes.

    MuJoCo's URDF reader discards <visual> and keeps <collision> -- which for
    a robot described with primitive collisions (boxes around the real shapes)
    exports a stack of crates instead of the machine. A <mujoco><compiler>
    block inside the URDF turns that off, and the package:// prefixes have to
    go so the meshes resolve against the model's own directory.
    """
    path = os.path.expanduser(path)
    here = os.path.dirname(os.path.abspath(path))
    src = open(path).read()
    block = ('<mujoco><compiler discardvisual="false" strippath="false" '
             f'meshdir="{here}/"/></mujoco>')
    src = re.sub(r"(<robot\b[^>]*>)", lambda m: m.group(1) + block, src, count=1)
    src = re.sub(r'filename="package://[^"]*?([^/"]+)"', r'filename="\1"', src)
    with tempfile.NamedTemporaryFile("w", suffix=".urdf", delete=False) as f:
        f.write(src)
        tmp = f.name
    try:
        return mujoco.MjModel.from_xml_path(tmp)
    finally:
        os.unlink(tmp)


def visual_groups(model):
    """The geom groups that are purely visual -- never the collision hulls."""
    seen = {int(model.geom_group[g]) for g in range(model.ngeom)
            if model.geom_contype[g] == 0 and model.geom_conaffinity[g] == 0}
    return seen or None


def sweep(model, t, amplitude=0.40):
    """A periodic pose: every joint sweeps its own slow sine, and the whole
    thing returns exactly to its start at t = 1, so the motion loops."""
    q = np.zeros(model.nq)
    for j in range(model.njnt):
        lo, hi = model.jnt_range[j]
        if lo >= hi:                       # unlimited joint
            lo, hi = -np.pi, np.pi
        mid, half = (lo + hi) / 2, (hi - lo) / 2
        turns = 1 + (j % 2)                # one or two turns per loop
        q[model.jnt_qposadr[j]] = mid + min(amplitude * half, 0.85) * np.sin(
            2 * np.pi * turns * t + j * 0.9)
    return q


def frame_camera(model, data, poses, aspect, groups, elevation, margin=0.94):
    """A camera framed by MEASURING, not by guessing: put everything the
    motion ever covers at a distance, project it, and scale the distance by
    how far it overflows. Three passes are enough -- the projection is very
    nearly linear in 1/d."""
    pts = []
    for q in poses:
        data.qpos[:len(q)] = q
        mujoco.mj_forward(model, data)
        for g in range(model.ngeom):
            if groups is not None and int(model.geom_group[g]) not in groups:
                continue
            c, R = data.geom_xpos[g], data.geom_xmat[g].reshape(3, 3)
            r = float(model.geom_rbound[g] or 0.05)
            for sgn in ((r, 0, 0), (-r, 0, 0), (0, r, 0), (0, -r, 0), (0, 0, r), (0, 0, -r)):
                pts.append(c + R @ np.array(sgn, float))
    pts = np.array(pts)
    lo, hi = pts.min(axis=0), pts.max(axis=0)
    cam = mujoco.MjvCamera()
    mujoco.mjv_defaultCamera(cam)
    cam.lookat[:] = (lo + hi) / 2
    cam.azimuth, cam.elevation = 135, elevation
    cam.distance = float(np.linalg.norm(hi - lo))
    f = 1.0 / np.tan(np.radians(model.vis.global_.fovy) / 2)
    for _ in range(3):
        az, el = np.radians(cam.azimuth), np.radians(cam.elevation)
        fwd = np.array([np.cos(el) * np.cos(az), np.cos(el) * np.sin(az), np.sin(el)])
        pos = np.array(cam.lookat) - fwd * cam.distance
        right = np.cross(fwd, [0.0, 0.0, 1.0]); right /= np.linalg.norm(right)
        up = np.cross(right, fwd)
        v = pts - pos
        z = v @ fwd
        over = max(np.abs((v @ right) * f / aspect / z).max(),
                   np.abs((v @ up) * f / z).max()) / margin
        cam.distance *= over
    return cam



def model_data(model, groups):
    """The kinematic tree, the visual geoms and the meshes of the model.

    Only the geoms the film drew (`groups`, the purely visual ones) are
    exported: the collision hulls are not what the audience sees.
    """
    bodies = []
    for b in range(model.nbody):
        joints = []
        for j in range(model.njnt):
            if model.jnt_bodyid[j] != b:
                continue
            joints.append({
                "name": mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_JOINT, j),
                "type": int(model.jnt_type[j]),
                "qpos": int(model.jnt_qposadr[j]),
                "pos": model.jnt_pos[j].tolist(),
                "axis": model.jnt_axis[j].tolist(),
            })
        bodies.append({
            "name": mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_BODY, b) or "world",
            "parent": int(model.body_parentid[b]),
            "pos": model.body_pos[b].tolist(),
            "quat": model.body_quat[b].tolist(),
            "joints": joints,
        })

    # The meshes, laid end to end in one buffer: positions then triangles, so
    # that the same file serves WebGL as vertex data and as index data.
    blob, meshes = bytearray(), []
    for m in range(model.nmesh):
        va, vn = int(model.mesh_vertadr[m]), int(model.mesh_vertnum[m])
        fa, fn = int(model.mesh_faceadr[m]), int(model.mesh_facenum[m])
        verts = model.mesh_vert[va:va + vn].astype(np.float32)
        faces = model.mesh_face[fa:fa + fn].astype(np.uint32)
        vbytes = verts.tobytes()
        while len(blob) % 4:                     # keep every view 4-aligned
            blob.append(0)
        voff = len(blob)
        blob += vbytes
        foff = len(blob)
        blob += faces.tobytes()
        meshes.append({"vertices": [voff, vn], "faces": [foff, fn]})

    geoms = []
    for g in range(model.ngeom):
        if model.geom_type[g] != mujoco.mjtGeom.mjGEOM_MESH:
            continue
        if groups is not None and int(model.geom_group[g]) not in groups:
            continue
        geoms.append({
            "body": int(model.geom_bodyid[g]),
            "mesh": int(model.geom_dataid[g]),
            "pos": model.geom_pos[g].tolist(),
            "quat": model.geom_quat[g].tolist(),
            "rgba": model.geom_rgba[g].tolist(),
        })
    return {"bodies": bodies, "geoms": geoms, "meshes": meshes}, blob


def rpy_quat(rpy):
    """URDF roll-pitch-yaw to a MuJoCo quaternion (w, x, y, z)."""
    r, p, y = (float(v) for v in rpy)
    cr, sr, cp, sp, cy, sy = (np.cos(r / 2), np.sin(r / 2), np.cos(p / 2),
                              np.sin(p / 2), np.cos(y / 2), np.sin(y / 2))
    return [cr * cp * cy + sr * sp * sy, sr * cp * cy - cr * sp * sy,
            cr * sp * cy + sr * cp * sy, cr * cp * sy - sr * sp * cy]


def sites(urdf, model, wanted):
    """The frames MuJoCo welds away, kept as named points on their body.

    A link joined by a FIXED joint is merged into its parent: the browser
    would have no way to speak of it, and a closed chain names exactly such a
    point (the effector the two branches of a five-bar share). They are read
    from the URDF itself, which still has them, and `wanted` gives each the
    name the lecture uses: --site effector=closing_effector_1.
    """
    if not wanted:
        return []
    by_child = {}
    for j in ET.parse(urdf).getroot().iter("joint"):
        if j.get("type") != "fixed":
            continue
        child = j.find("child").get("link")
        parent = j.find("parent").get("link")
        o = j.find("origin")
        by_child[child] = (parent,
                           [float(v) for v in (o.get("xyz") or "0 0 0").split()],
                           rpy_quat((o.get("rpy") or "0 0 0").split()))
    names = [mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_BODY, b) or "world"
             for b in range(model.nbody)]
    out = []
    for spec in wanted:
        name, _, link = spec.partition("=")
        if link not in by_child:
            raise SystemExit(f"{link}: no fixed joint leads to it in {urdf}")
        parent, pos, quat = by_child[link]
        if parent not in names:
            raise SystemExit(f"{link}: its parent {parent} is not a body of the model")
        out.append({"name": name, "body": names.index(parent), "pos": pos, "quat": quat})
    return out


def motion_rows(model, track, frames, rate, amplitude):
    """The configurations to play, and the rate they are played at.

    From the film's track when there is one — the robot then moves exactly as
    the video did — otherwise from the sweep mujoco_render.py uses, sampled
    over one period.
    """
    if track:
        with open(track) as f:
            data = json.load(f)
        rows = [row["q"] for row in data["track"]]
        return rows, float(data["fps"])
    return ([sweep(model, i / frames, amplitude).tolist() for i in range(frames)], rate)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("urdf")
    ap.add_argument("stem", help="assets/robots/<name>3d, without extension")
    ap.add_argument("--track", help="the film's track, to replay its motion")
    ap.add_argument("--frames", type=int, default=360)
    ap.add_argument("--rate", type=float, default=30.0)
    ap.add_argument("--width", type=int, default=1600)
    ap.add_argument("--height", type=int, default=900)
    ap.add_argument("--elevation", type=float, default=-20.0)
    ap.add_argument("--amplitude", type=float, default=0.40)
    ap.add_argument("--site", action="append", default=[],
                    metavar="NAME=LINK",
                    help="keep a welded fixed frame under a name of its own")
    args = ap.parse_args()

    model = load_model(args.urdf)
    data = mujoco.MjData(model)
    groups = visual_groups(model)

    rows, rate = motion_rows(model, args.track, args.frames, args.rate, args.amplitude)
    md, blob = model_data(model, groups)
    md["sites"] = sites(args.urdf, model, args.site)

    # The camera of the film, framed by the film's own code, on the same
    # motion: the live picture then stands where the video stood.
    aspect = args.width / args.height
    poses = rows[::max(1, len(rows) // 60)]
    cam = frame_camera(model, data, poses, aspect, groups, args.elevation)

    out = {
        "model": md,
        "fovy": float(model.vis.global_.fovy),
        "aspect": aspect,
        "rate": rate,
        "motion": rows,
        "camera": {"lookat": list(map(float, cam.lookat)),
                   "distance": float(cam.distance),
                   "azimuth": float(cam.azimuth),
                   "elevation": float(cam.elevation)},
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.stem)), exist_ok=True)
    with open(f"{args.stem}.bin", "wb") as f:
        f.write(bytes(blob))
    with open(f"{args.stem}.json", "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"{args.stem}.json  {len(md['bodies'])} bodies, {len(md['geoms'])} geoms, "
          f"{len(md['meshes'])} meshes, {len(md['sites'])} sites, "
          f"{len(rows)} poses at {rate} Hz")
    print(f"{args.stem}.bin   {len(blob) / 1e6:.2f} MB")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Convert STL file to triangles.json format with WebGL coordinate system
Transforms from Blender's Z-up to WebGL's Y-up coordinate system
"""

import struct
import json
import numpy as np
from collections import defaultdict


def blender_to_webgl(vertex):
    """
    Convert vertex/normal from Blender (Z-up) to WebGL (Y-up) coordinates
    Transformation: X_webgl = X_blender, Y_webgl = Z_blender, Z_webgl = -Y_blender
    """
    return [vertex[0], vertex[2], -vertex[1]]


def read_stl_binary(filename):
    """Read binary STL file and return triangles with normals"""
    triangles = []
    
    with open(filename, 'rb') as f:
        # Skip 80-byte header
        header = f.read(80)
        
        # Read number of triangles
        num_triangles = struct.unpack('I', f.read(4))[0]
        
        # Read each triangle
        for i in range(num_triangles):
            # Read normal vector (3 floats)
            normal = struct.unpack('fff', f.read(12))
            
            # Read 3 vertices (3 floats each)
            v1 = struct.unpack('fff', f.read(12))
            v2 = struct.unpack('fff', f.read(12))
            v3 = struct.unpack('fff', f.read(12))
            
            # Skip attribute byte count
            f.read(2)
            
            # Convert to WebGL coordinate system
            triangles.append({
                'normal': blender_to_webgl(list(normal)),
                'vertices': [
                    blender_to_webgl(list(v1)),
                    blender_to_webgl(list(v2)),
                    blender_to_webgl(list(v3))
                ]
            })
    
    return triangles


def read_stl_ascii(filename):
    """Read ASCII STL file and return triangles with normals"""
    triangles = []
    
    with open(filename, 'r') as f:
        current_triangle = {}
        vertices = []
        
        for line in f:
            line = line.strip()
            
            if line.startswith('facet normal'):
                parts = line.split()
                normal = [float(parts[2]), float(parts[3]), float(parts[4])]
                # Convert to WebGL coordinates
                current_triangle['normal'] = blender_to_webgl(normal)
                vertices = []
                
            elif line.startswith('vertex'):
                parts = line.split()
                vertex = [float(parts[1]), float(parts[2]), float(parts[3])]
                # Convert to WebGL coordinates
                vertices.append(blender_to_webgl(vertex))
                
            elif line.startswith('endfacet'):
                current_triangle['vertices'] = vertices
                triangles.append(current_triangle)
                current_triangle = {}
    
    return triangles


def is_binary_stl(filename):
    """Check if STL file is binary or ASCII"""
    with open(filename, 'rb') as f:
        header = f.read(80)
        try:
            header_str = header.decode('ascii')
            if 'solid' in header_str.lower():
                # Might be ASCII, check further
                f.seek(0)
                try:
                    first_line = f.read(100).decode('ascii')
                    if first_line.strip().startswith('solid'):
                        return False
                except:
                    return True
            return True
        except:
            return True


def convert_stl_to_json(stl_filename, json_filename, material=None):
    """
    Convert STL file to triangles.json format with WebGL coordinates
    
    Args:
        stl_filename: Input STL file path
        json_filename: Output JSON file path
        material: Optional material properties dict
    """
    # Default material if none provided
    if material is None:
        material = {
            "ambient": [0.1, 0.1, 0.1],
            "diffuse": [0.6, 0.4, 0.4],
            "specular": [0.3, 0.3, 0.3],
            "n": 11
        }
    
    # Read STL file
    print(f"Reading {stl_filename}...")
    if is_binary_stl(stl_filename):
        print("Detected binary STL format")
        triangles = read_stl_binary(stl_filename)
    else:
        print("Detected ASCII STL format")
        triangles = read_stl_ascii(stl_filename)
    
    print(f"Found {len(triangles)} triangles")
    print("Converting from Blender (Z-up) to WebGL (Y-up) coordinate system...")
    
    # Build vertex list and deduplicate
    vertex_map = {}  # map from vertex tuple to index
    vertices = []
    normals = []
    triangle_indices = []
    
    epsilon = 1e-6  # Tolerance for vertex matching
    
    for tri in triangles:
        tri_indices = []
        for i, vertex in enumerate(tri['vertices']):
            # Round vertices to avoid floating point issues
            vertex_tuple = tuple(round(v, 6) for v in vertex)
            
            if vertex_tuple not in vertex_map:
                vertex_map[vertex_tuple] = len(vertices)
                vertices.append(vertex)
                normals.append(tri['normal'])  # Use face normal for now
                tri_indices.append(len(vertices) - 1)
            else:
                tri_indices.append(vertex_map[vertex_tuple])
        
        triangle_indices.append(tri_indices)
    
    # Create output structure
    output = [{
        "material": material,
        "vertices": vertices,
        "normals": normals,
        "triangles": triangle_indices
    }]
    
    # Write JSON file
    print(f"Writing {json_filename}...")
    with open(json_filename, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"Conversion complete!")
    print(f"Total vertices: {len(vertices)}")
    print(f"Total triangles: {len(triangle_indices)}")
    print(f"Coordinate system: WebGL (Y-up, right-handed)")


if __name__ == "__main__":
    import sys
    
    # Default filenames
    stl_file = "deadpool.stl"
    json_file = "scene_triangles_deadpool.json"
    
    # Parse command line arguments if provided
    if len(sys.argv) > 1:
        stl_file = sys.argv[1]
    if len(sys.argv) > 2:
        json_file = sys.argv[2]
    
    # Optional: customize material properties
    material = {
        "ambient": [0.1, 0.1, 0.1],
        "diffuse": [0.6, 0.4, 0.4],
        "specular": [0.3, 0.3, 0.3],
        "n": 11
    }
    
    convert_stl_to_json(stl_file, json_file, material)